import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ExampleDto } from './dto/example.dto';

@ApiTags('examples')
@Controller('examples')
export class ExampleController {
  @Post()
  @ApiOperation({ summary: 'Create an example payload' })
  @ApiResponse({ status: 201, description: 'Example created' })
  create(@Body() dto: ExampleDto) {
    return { success: true, data: dto };
  }
}
