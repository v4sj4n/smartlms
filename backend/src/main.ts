import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./api/app.module";
import { ValidationPipeOpts } from "./common/pipes/validation-options";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	app.useGlobalPipes(new ValidationPipe(ValidationPipeOpts));
	await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
