import { NextFunction, Request, Response } from 'express';
import { Container } from 'typedi';
import { RequestWithUser } from '@interfaces/auth.interface';
import { AuthService } from '@services/auth.service';
import { logger } from '@utils/logger';
import { RegisterInput, LoginInput, GitHubCallbackInput, UpdateProfileInput, ChangePasswordInput } from '@schemas/auth.schema';

export class AuthController {
  public authService = Container.get(AuthService);

  //REGISTER
  public register = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, name } = request.body as RegisterInput;

      logger.info({ email }, 'Registration attempt');

      const result = await this.authService.registerUser(email, password, name);

      // Create session
      const sessionToken = result.token;
      const ipAddress = request.ip;
      const userAgent = request.get('user-agent');

      await this.authService.createSession(result.user.id, sessionToken, ipAddress, userAgent);

      response.status(201).json({
        message: 'User registered successfully',
        token: result.token,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  };

  //LOGIN
  public login = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = request.body as LoginInput;

      logger.info({ email }, 'Login attempt');

      const result = await this.authService.loginUser(email, password);

      // Create session
      const sessionToken = result.token;
      const ipAddress = request.ip;
      const userAgent = request.get('user-agent');

      await this.authService.createSession(result.user.id, sessionToken, ipAddress, userAgent);

      response.status(200).json({
        message: 'Login successful',
        token: result.token,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  };

  //GITHUB CALLBACK
  public githubCallback = async (request: Request, response: Response): Promise<void> => {
    try {
      const { code } = request.query as unknown as GitHubCallbackInput;

      logger.info('GitHub OAuth callback received');

      const result = await this.authService.handleGitHubOAuth(code);

      // Create session
      const sessionToken = result.token;
      const ipAddress = request.ip;
      const userAgent = request.get('user-agent');

      await this.authService.createSession(result.user.id, sessionToken, ipAddress, userAgent);

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${frontendUrl}/auth/github/callback?token=${result.token}`;

      response.redirect(redirectUrl);
    } catch (error) {
      // Redirect to frontend with error
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      const redirectUrl = `${frontendUrl}/auth/github/callback?error=${encodeURIComponent(errorMessage)}`;

      response.redirect(redirectUrl);
    }
  };

  //GET CURRENT USER
  public getCurrentUser = async (request: RequestWithUser, response: Response, next: NextFunction): Promise<void> => {
    try {
      if (!request.user) {
        logger.error('getCurrentUser called without user in requestuest');
        throw new Error('User not authenticated');
      }

      const userId = request.user.id;

      const user = await this.authService.getUserById(userId);

      response.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  };

  //UPDATE PROFILE
  public updateProfile = async (request: RequestWithUser, response: Response, next: NextFunction): Promise<void> => {
    try {
      if (!request.user) {
        logger.error('updateProfile called without user in requestuest');
        throw new Error('User not authenticated');
      }

      const userId = request.user.id;
      const data = request.body as UpdateProfileInput;

      logger.info({ userId }, 'Profile update attempt');

      const user = await this.authService.updateProfile(userId, data);

      response.status(200).json({
        message: 'Profile updated successfully',
        user,
      });
    } catch (error) {
      next(error);
    }
  };

  //CHANGE PASSWORD
  public changePassword = async (request: RequestWithUser, response: Response, next: NextFunction): Promise<void> => {
    try {
      if (!request.user) {
        logger.error('changePassword called without user in requestuest');
        throw new Error('User not authenticated');
      }

      const userId = request.user.id;
      const { currentPassword, newPassword } = request.body as ChangePasswordInput;

      logger.info({ userId }, 'Password change attempt');

      await this.authService.changePassword(userId, currentPassword, newPassword);

      response.status(200).json({
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  //LOGOUT
  public logout = async (request: RequestWithUser, response: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = request.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');

      if (token) {
        logger.info('Logout attempt');
        await this.authService.deleteSession(token);
      }

      response.status(200).json({
        message: 'Logout successful',
      });
    } catch (error) {
      next(error);
    }
  };
}
