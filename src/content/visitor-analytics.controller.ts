import { Body, Controller, Get, Header, HttpCode, Post, Query, Req, StreamableFile, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AdminGuard } from '../auth/auth.guard';
import { VisitorEventDto, VisitorReportQueryDto } from '../common/dto/analytics.dto';
import { VisitorAnalyticsService } from './visitor-analytics.service';
import { visitorWorkbook } from './visitor-workbook';

@Controller('analytics')
export class VisitorTrackingController {
  constructor(private readonly analytics: VisitorAnalyticsService) {}
  @Post('visitors') @HttpCode(202) @Throttle({ default: { limit: 60, ttl: 60000 } })
  record(@Body() dto: VisitorEventDto, @Req() request: Request) { return this.analytics.record(dto,request); }
}

@Controller('admin/analytics/visitors')
@UseGuards(AdminGuard)
export class VisitorAnalyticsController {
  constructor(private readonly analytics: VisitorAnalyticsService) {}
  @Get() @Header('Cache-Control','no-store')
  report(@Query() query: VisitorReportQueryDto) { return this.analytics.report(query); }
  @Get('events') @Header('Cache-Control','no-store')
  events(@Query() query: VisitorReportQueryDto) { return this.analytics.events(query); }
  @Get('export') @Header('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') @Header('Content-Disposition','attachment; filename="dpo-visitors.xlsx"') @Header('Cache-Control','no-store')
  async export(@Query() query: VisitorReportQueryDto) {
    const {data,summary} = await this.analytics.events(query,true);
    return new StreamableFile(await visitorWorkbook(data,summary!));
  }
}
