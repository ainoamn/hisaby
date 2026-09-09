import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsISO8601,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const BHD_R_EVENT_TYPES = [
  'stay.payment.succeeded',
  'lease.invoice.issued',
  'lease.payment.received',
  'expense.paid',
  'expense.approved',
  'deposit.held',
  'deposit.released',
] as const;

export type BhdREventType = (typeof BHD_R_EVENT_TYPES)[number];

export class BhdRAddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  governorate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  wilayat?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;
}

export class BhdRCounterpartyDto {
  @ApiProperty({ example: 'أحمد الكندي' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'pty_123' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && !value.trim() ? undefined : value,
  )
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  taxId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => BhdRAddressDto)
  address?: BhdRAddressDto;
}

export class BhdRPropertyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => BhdRAddressDto)
  address?: BhdRAddressDto;
}

export class BhdRUnitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  code?: string;
}

export class BhdRSourceRefsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  bookingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  invoiceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  paymentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  expenseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  leaseId?: string;
}

export class BhdRInboundEventDto {
  @ApiProperty({ example: 'bhd-r:stay-pay:abc' })
  @IsString()
  @MinLength(8)
  @MaxLength(180)
  idempotencyKey: string;

  @ApiProperty({ enum: BHD_R_EVENT_TYPES })
  @IsIn(BHD_R_EVENT_TYPES)
  type: BhdREventType;

  @ApiProperty({ example: '2026-09-09T10:00:00.000Z' })
  @IsISO8601()
  occurredOn: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsISO8601()
  dueOn?: string;

  @ApiProperty({ example: '150000', description: 'Integer minor units (OMR baisa = 3 decimals)' })
  @IsString()
  @Matches(/^-?\d+$/)
  amountMinor: string;

  @ApiProperty({ example: 'OMR' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency: string;

  @ApiPropertyOptional({
    enum: ['inbound', 'outbound'],
    description: 'inbound = وارد (إيراد) · outbound = صادر (مصروف)',
  })
  @IsOptional()
  @IsIn(['inbound', 'outbound'])
  direction?: 'inbound' | 'outbound';

  @ApiPropertyOptional({ example: 'حساب البنك — وارد' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  accountLabel?: string;

  @ApiPropertyOptional({ example: 'bhd-r-org-uuid' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  organizationExternalId?: string;

  @ApiPropertyOptional({ description: 'Alias of organizationExternalId from BHD-R architecture doc' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  organizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  propertyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  unitId?: string;

  @ApiPropertyOptional({ example: 'bhd-r' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => BhdRCounterpartyDto)
  counterparty?: BhdRCounterpartyDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => BhdRPropertyDto)
  property?: BhdRPropertyDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => BhdRUnitDto)
  unit?: BhdRUnitDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  memo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => BhdRSourceRefsDto)
  sourceRefs?: BhdRSourceRefsDto;
}

export class UpdateBhdRSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  organizationExternalId?: string;

  @ApiPropertyOptional({
    description: 'Paste a BHD-R read API key. Empty string clears the stored key.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  readApiKey?: string;
}
