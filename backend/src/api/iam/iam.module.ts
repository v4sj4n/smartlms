import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { HashingModule } from "./hashing/hashing.module";

@Module({
	imports: [AuthModule, HashingModule],
})
export class IamModule {}
