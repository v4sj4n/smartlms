import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipeOpts } from "./common/pipes/validation-options";
import { JwtAuthGuard } from "./common/guards/jwt.guard";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	app.setGlobalPrefix("api");
	app.useGlobalPipes(new ValidationPipe(ValidationPipeOpts));

	await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
