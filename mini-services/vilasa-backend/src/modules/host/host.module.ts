import { Module } from "@nestjs/common";

import { PropertiesModule } from "../properties/properties.module";
import { HostController } from "./host.controller";
import { HostService } from "./host.service";

@Module({
  imports: [PropertiesModule],
  controllers: [HostController],
  providers: [HostService],
})
export class HostModule {}
