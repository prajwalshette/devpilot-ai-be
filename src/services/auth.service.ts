import { PrismaClient } from '@prisma/client';
import bcrypt from "bcrypt";
import axios from 'axios';
import { sign, verify } from "jsonwebtoken";
import { Service } from 'typedi';
import { SECRET_KEY, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_CALLBACK_URL } from '@config';
import { DataStoredInToken, TokenData } from '@interfaces/auth.interface';
import { logger } from '@utils/logger';
import { BadRequestException, UnauthorizedException, ConflictException, NotFoundException, InternalServerErrorException } from '@exceptions/index';
import { prisma } from '@database/index';
import { AuthProvider } from "@prisma/client";

@Service()
export class AuthService {
  // CREATE JWT TOKEN
  public createToken(userId: string): TokenData {
    const dataStoredInToken: DataStoredInToken = { userId };
    const expiresIn: number = 60 * 60 * 12;

    return {
      expiresIn,
      token: sign(dataStoredInToken, SECRET_KEY!, { expiresIn }),
    };
  }

  // VERIFY JWT TOKEN
  public verifyToken(token: string): DataStoredInToken {
    try {
      const decoded = verify(
        token,
        SECRET_KEY!
      ) as unknown as DataStoredInToken;
      return decoded;
    } catch (error) {
      logger.warn({ error }, "JWT verification failed");
      throw new UnauthorizedException("Invalid or expired token");
    }
  };

  // REGISTER USER
  public async registerUser(email: string, password: string, name: string) {
    try {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        logger.warn({ email }, "Registration failed: Email already exists");
        throw new ConflictException("Email already registered");
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          emailVerified: new Date(),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          image: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Create token for the new user
      const tokenData = this.createToken(user.id);

      logger.info({ userId: user.id, email }, "User registered successfully");
      return { ...tokenData, user };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      logger.error({ error, email }, "Failed to register user");
      throw new InternalServerErrorException("Failed to register user");
    }
  }

  // LOGIN USER
  public async loginUser(email: string, password: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || !user.password) {
        logger.warn({ email }, "Login failed: Invalid credentials");
        throw new UnauthorizedException("Invalid credentials");
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        logger.warn({ email }, "Login failed: Incorrect password");
        throw new UnauthorizedException("Invalid credentials");
      }

      const tokenData = this.createToken(user.id);
      const { password: _, ...userWithoutPassword } = user;

      logger.info({ userId: user.id, email }, "User logged in successfully");
      return { ...tokenData, user: userWithoutPassword };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      logger.error({ error, email }, "Failed to login user");
      throw new InternalServerErrorException("Failed to login");
    }
  }

  // GITHUB OAUTH
  public async handleGitHubOAuth(code: string) {
    try {
      logger.info("Exchanging GitHub OAuth code for access token");
      const tokenResponse = await axios.post(
        "https://github.com/login/oauth/access_token",
        {
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: GITHUB_CALLBACK_URL,
        },
        {
          headers: { Accept: "application/json" },
        }
      );

      const accessToken = tokenResponse.data.access_token;

      if (!accessToken) {
        logger.error("GitHub OAuth failed: No access token received");
        throw new BadRequestException("Failed to authenticate with GitHub");
      }

      logger.info("Fetching GitHub user profile");
      const userResponse = await axios.get("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const githubUser = userResponse.data;

      let email = githubUser.email;
      if (!email) {
        const emailsResponse = await axios.get(
          "https://api.github.com/user/emails",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        const primaryEmail = emailsResponse.data.find((e: any) => e.primary);
        email = primaryEmail?.email;
      }

      if (!email) {
        logger.error(
          { githubId: githubUser.id },
          "GitHub OAuth failed: No email found"
        );
        throw new BadRequestException(
          "GitHub account must have a verified email"
        );
      }

      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name: githubUser.name || githubUser.login,
            image: githubUser.avatar_url,
            emailVerified: new Date(),
          },
        });
        logger.info(
          { userId: user.id, email },
          "New user created via GitHub OAuth"
        );
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name: githubUser.name || user.name,
            image: githubUser.avatar_url || user.image,
          },
        });
        logger.info(
          { userId: user.id, email },
          "Existing user updated via GitHub OAuth"
        );
      }

      const existingAccount = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: AuthProvider.GITHUB,
            providerAccountId: String(githubUser.id),
          },
        },
      });

      if (!existingAccount) {
        await prisma.account.create({
          data: {
            userId: user.id,
            type: "oauth",
            provider: AuthProvider.GITHUB,
            providerAccountId: String(githubUser.id),
            accessToken,
            tokenType: "bearer",
            scope: tokenResponse.data.scope,
            metadata: {
              login: githubUser.login,
              avatarUrl: githubUser.avatar_url,
              htmlUrl: githubUser.html_url,
            },
          },
        });
        logger.info({ userId: user.id }, "GitHub account linked");
      } else {
        await prisma.account.update({
          where: { id: existingAccount.id },
          data: {
            accessToken,
            scope: tokenResponse.data.scope,
          },
        });
        logger.info({ userId: user.id }, "GitHub account token updated");
      }

      const tokenData = this.createToken(user.id);
      const { password: _, ...userWithoutPassword } = user;

      return { ...tokenData, user: userWithoutPassword };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      logger.error({ error }, "GitHub OAuth failed");
      throw new InternalServerErrorException(
        "Failed to authenticate with GitHub"
      );
    }
  }

  // CREATE SESSION
  public async createSession(
    userId: string,
    sessionToken: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const session = await prisma.session.create({
        data: {
          userId,
          sessionToken,
          expires: expiresAt,
          ipAddress,
          userAgent,
        },
      });

      logger.info({ userId, sessionId: session.id }, "Session created");
      return session;
    } catch (error) {
      logger.error({ error, userId }, "Failed to create session");
      throw new InternalServerErrorException("Failed to create session");
    }
  }

  // DELETE SESSION
  public async deleteSession(sessionToken: string) {
    try {
      await prisma.session.delete({
        where: { sessionToken },
      });

      logger.info({ sessionToken }, "Session deleted");
    } catch (error) {
      logger.error({ error, sessionToken }, "Failed to delete session");
      throw new InternalServerErrorException("Failed to logout");
    }
  }

  // GET USER BY ID
  public async getUserById(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          image: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        logger.warn({ userId }, "User not found");
        throw new NotFoundException("User not found");
      }

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      logger.error({ error, userId }, "Failed to get user");
      throw new InternalServerErrorException("Failed to get user");
    }
  }

  // UPDATE PROFILE
  public async updateProfile(userId: string, data: { name?: string; image?: string }) {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          image: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info({ userId }, "User profile updated");
      return user;
    } catch (error) {
      logger.error({ error, userId }, "Failed to update profile");
      throw new InternalServerErrorException("Failed to update profile");
    }
  }

  // CHANGE PASSWORD
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.password) {
        logger.warn(
          { userId },
          "Password change failed: User not found or no password set"
        );
        throw new BadRequestException(
          "Cannot change password for this account"
        );
      }

      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );

      if (!isPasswordValid) {
        logger.warn(
          { userId },
          "Password change failed: Incorrect current password"
        );
        throw new UnauthorizedException("Current password is incorrect");
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      logger.info({ userId }, "Password changed successfully");
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      logger.error({ error, userId }, "Failed to change password");
      throw new InternalServerErrorException("Failed to change password");
    }
  }

}
