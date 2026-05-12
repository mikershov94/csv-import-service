import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum ImportStatus {
    QUEUED = 'queued',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    COMPLETED_WITH_ERRORS = 'completed_with_errors',
    FAILED = 'failed',
}

@Schema({ _id: false })
export class ImportErrorSummaryItem {
    @Prop({ required: true, trim: true, minlength: 1 })
    code!: string;

    @Prop({ required: true, trim: true, minlength: 1 })
    message!: string;

    @Prop({ required: true, min: 1, validate: Number.isInteger })
    count!: number;
}

export const ImportErrorSummaryItemSchema = SchemaFactory.createForClass(ImportErrorSummaryItem);

export type ImportDocument = HydratedDocument<Import>;

@Schema({
    timestamps: true,
    collection: 'imports',
})
export class Import {
    @Prop({
        required: true,
        enum: ImportStatus,
        type: String,
        default: ImportStatus.QUEUED,
    })
    status!: ImportStatus;

    @Prop({ required: true, trim: true, minlength: 1 })
    fileName!: string;

    @Prop({ required: true, min: 0, validate: Number.isInteger })
    fileSizeBytes!: number;

    @Prop({ default: 0, min: 0, validate: Number.isInteger })
    totalRows!: number;

    @Prop({ default: 0, min: 0, validate: Number.isInteger })
    processedRows!: number;

    @Prop({ default: 0, min: 0, validate: Number.isInteger })
    successRows!: number;

    @Prop({ default: 0, min: 0, validate: Number.isInteger })
    failedRows!: number;

    @Prop({ default: 0, min: 0, validate: Number.isInteger })
    insertedCount!: number;

    @Prop({ default: 0, min: 0, validate: Number.isInteger })
    updatedCount!: number;

    @Prop({ type: [ImportErrorSummaryItemSchema], default: [] })
    errorSummary!: ImportErrorSummaryItem[];

    @Prop()
    startedAt?: Date;

    @Prop()
    finishedAt?: Date;
}

export const ImportSchema = SchemaFactory.createForClass(Import);

ImportSchema.index({ createdAt: -1 }, { name: 'idx_created_at_desc' });
