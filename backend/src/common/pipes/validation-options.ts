import type { ValidationPipeOptions } from "@nestjs/common";

export const ValidationPipeOpts: ValidationPipeOptions = {
	whitelist: true,
	forbidNonWhitelisted: true,
	transform: true,
	transformOptions: {
		enableImplicitConversion: true,
	},
};
