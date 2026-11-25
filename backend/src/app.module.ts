import { Module } from '@nestjs/common';
import { GatewayModule } from './gateway/gateway.module';
import { MarketModule } from './market/market.module';
import { MetricsModule } from './metrics/metrics.module';
import { OpsController } from './ops/ops.controller';
import { StocksController } from './stocks/stocks.controller';

@Module({
  imports: [MarketModule, MetricsModule, GatewayModule],
  controllers: [StocksController, OpsController],
})
export class AppModule {}
