import { BadRequestException, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { HashingService } from "../hashing/hashing.service";
import { LoginDto } from "./dto/login.dto";

const fakeUsers = [
	{
		id: 1,
		email: "user@example.com",
		password: "$argon2id$v=19$m=65536,t=3,p=4$VjqFZukUJytJ+OreLF+yrw$WXX371TVjr8BnijhwfXeH2XaIUaR2GF9g76X3cPMx5g",
	},
	{
		id: 2,
		email: "user2@example.com",
		password: "$argon2id$v=19$m=65536,t=3,p=4$VjqFZukUJytJ+OreLF+yrw$WXX371TVjr8BnijhwfXeH2XaIUaR2GF9g76X3cPMx5g",
	},
];

@Injectable()
export class AuthService {
	constructor(
		private readonly hashingService: HashingService,
		private jwtService: JwtService,
	) { }
	login(loginDto: LoginDto) {
		return this.validateUser(loginDto);
	}

	private async validateUser({ email, password }: LoginDto) {
		const user = fakeUsers.find((u) => u.email === email);
		if (!user) throw new BadRequestException("User was not found");
		const isPasswordValid = await this.hashingService.compare(password, user.password);
		if (!isPasswordValid) return null;
		return this.jwtService.sign({ sub: user.id, email: user.email });
	}
}
