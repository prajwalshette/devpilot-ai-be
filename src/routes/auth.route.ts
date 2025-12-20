import { Router } from 'express';
import { AuthController } from '@controllers/auth.controller';
import { Routes } from '@interfaces/routes.interface';
import { AuthMiddleware } from '@middlewares/auth.middleware';
import { ZodValidationMiddleware } from '@middlewares/validation.middleware';
import { RegisterSchema, LoginSchema, GitHubCallbackSchema, UpdateProfileSchema, ChangePasswordSchema } from '@schemas/auth.schema';

export class AuthRoute implements Routes {
  public path = '/auth';
  public router = Router();
  public authController = new AuthController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // PUBLIC ROUTES
    // Register
    this.router.post(
      `${this.path}/register`,
      ZodValidationMiddleware(RegisterSchema, "body"),
      this.authController.register
    );

    // Login
    this.router.post(
      `${this.path}/login`,
      ZodValidationMiddleware(LoginSchema, "body"),
      this.authController.login
    );

    // GitHub OAuth Callback
    this.router.get(
      `${this.path}/github/callback`,
      ZodValidationMiddleware(GitHubCallbackSchema, "query"),
      this.authController.githubCallback
    );

    // PROTECTED ROUTES (require authentication)
    // Get current user
    this.router.get(`${this.path}/me`, AuthMiddleware, this.authController.getCurrentUser);

    // Update profile
    this.router.put(
      `${this.path}/profile`,
      AuthMiddleware,
      ZodValidationMiddleware(UpdateProfileSchema, "body"),
      this.authController.updateProfile
    );

    // Change password
    this.router.put(
      `${this.path}/forgot-password`,
      AuthMiddleware,
      ZodValidationMiddleware(ChangePasswordSchema, "body"),
      this.authController.changePassword
    );

    // Logout
    this.router.post(`${this.path}/logout`, AuthMiddleware, this.authController.logout);
  }
}
