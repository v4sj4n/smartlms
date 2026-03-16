import { Module } from "@nestjs/common";
import { Argon2Service } from "./argon2.service";
import { HashingService } from "./hashing.service";

@Module({
	providers: [
		{
			provide: HashingService,
			useClass: Argon2Service,
		},
	],
	exports: [
		{
			provide: HashingService,
			useClass: Argon2Service,
		},
	],
})
export class HashingModule {}
