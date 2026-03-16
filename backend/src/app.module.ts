import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { IamModule } from "./api/iam/iam.module";
import { CommonModule } from "./common/common.module";

@Module({
  imports: [ConfigModule.forRoot(), CommonModule, IamModule],
})
export class AppModule {}
