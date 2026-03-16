import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import type { HashingService } from "./hashing.service";

@Injectable()
export class Argon2Service implements HashingService {
	async hash(data: string | Buffer): Promise<string> {
		return await argon2.hash(data);
	}
	compare(plainData: string | Buffer, encryptedData: string): Promise<boolean> {
		return argon2.verify(encryptedData, plainData);
	}
}
