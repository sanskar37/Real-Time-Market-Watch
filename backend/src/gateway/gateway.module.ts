import { Module } from '@nestjs/common';
import { MarketModule } from '../market/market.module';
import { MetricsModule } from '../metrics/metrics.module';
import { MarketGateway } from './market.gateway';

@Module({
  imports: [MarketModule, MetricsModule],
  providers: [MarketGateway],
  exports: [MarketGateway],
})
export class GatewayModule {}
