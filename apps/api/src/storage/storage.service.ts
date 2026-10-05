import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  async uploadFile(fileBuffer: Buffer, fileName: string, mimetype: string): Promise<string> {
    this.logger.log(`Mocking upload for file: ${fileName}`);
    // Simulação do retorno de uma URL pública (S3/Cloudinary/Firebase)
    return `https://storage.checkon.com/uploads/${Date.now()}-${fileName}`;
  }
}
