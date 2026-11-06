import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, resolve } from 'node:path';
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { AppConfig } from '../config.js';

export const MAX_PROOF_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
type ProofMimeType = (typeof ALLOWED_TYPES)[number];

export type StoredProof = {
  storageKey: string;
  fileName: string;
  mimeType: ProofMimeType;
  fileSizeBytes: number;
  sha256: string;
};

function detectMimeType(bytes: Buffer): ProofMimeType | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  return null;
}

function safeFileName(value: string): string {
  const name = basename(value.replace(/\\/gu, '/'))
    .replace(/[\u0000-\u001f\u007f]/gu, '')
    .trim()
    .slice(0, 255);
  return name || 'receipt-proof';
}

@Injectable()
export class ProofStorageService {
  private readonly directory: string;

  constructor(config: AppConfig) {
    const configured = config.inventoryProofStorageDir;
    this.directory = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }

  async store(file: Express.Multer.File | undefined): Promise<StoredProof> {
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw new BadRequestException({
        code: 'PROOF_FILE_REQUIRED',
        message: 'A receipt image or PDF proof is mandatory.',
      });
    }
    if (file.buffer.length > MAX_PROOF_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'PROOF_FILE_TOO_LARGE',
        message: 'The proof document must not exceed 10 MB.',
      });
    }

    const mimeType = detectMimeType(file.buffer);
    if (!mimeType || !ALLOWED_TYPES.includes(mimeType)) {
      throw new BadRequestException({
        code: 'PROOF_FILE_INVALID',
        message: 'The proof must be a JPEG, PNG, or PDF with a valid file signature.',
      });
    }

    const storageKey = randomUUID();
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await chmod(this.directory, 0o700);
    await writeFile(this.filePath(storageKey), file.buffer, { flag: 'wx', mode: 0o600 });

    return {
      storageKey,
      fileName: safeFileName(file.originalname),
      mimeType,
      fileSizeBytes: file.buffer.length,
      sha256: createHash('sha256').update(file.buffer).digest('hex'),
    };
  }

  async read(storageKey: string, expectedSha256: string): Promise<Buffer> {
    try {
      const bytes = await readFile(this.filePath(storageKey));
      const actualSha256 = createHash('sha256').update(bytes).digest('hex');
      if (actualSha256 !== expectedSha256) {
        throw new InternalServerErrorException({
          code: 'PROOF_INTEGRITY_FAILED',
          message: 'The stored receipt proof failed its integrity check.',
        });
      }
      return bytes;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
        throw new NotFoundException({ code: 'PROOF_FILE_NOT_FOUND', message: 'The stored proof file is unavailable.' });
      }
      throw error;
    }
  }

  async remove(storageKey: string): Promise<void> {
    await rm(this.filePath(storageKey), { force: true });
  }

  private filePath(storageKey: string): string {
    if (!/^[0-9a-f-]{36}$/iu.test(storageKey)) {
      throw new BadRequestException({ code: 'PROOF_FILE_INVALID', message: 'Invalid proof storage key.' });
    }
    return resolve(this.directory, `${storageKey}.proof`);
  }
}
