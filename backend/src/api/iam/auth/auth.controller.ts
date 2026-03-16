import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { AuthGuard } from "@nestjs/passport";
import { LocalAuthGuard } from "src/common/guards/local.guard";
import type { Request } from "express";
import { JwtAuthGuard } from "src/common/guards/jwt.guard";
import { Public } from "src/common/decorators/is-public.decorator";

@Controller("auth")
export class AuthController {
	constructor(private readonly authService: AuthService) { }

	@Public()
	@Post("login")
	@UseGuards(LocalAuthGuard)
	login(
		@Body() loginDto: LoginDto) {
		return this.authService.login(loginDto);
	}

	@Get("status")
	status(@Req() req: Request) {
		return req.user;
	}
}
