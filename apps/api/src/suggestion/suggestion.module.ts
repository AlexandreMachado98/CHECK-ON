import { Module } from '@nestjs/common';
import { PublicSuggestionController, SuggestionController } from './suggestion.controller';
import { SuggestionService } from './suggestion.service';

@Module({
  controllers: [SuggestionController, PublicSuggestionController],
  providers: [SuggestionService],
})
export class SuggestionModule {}
