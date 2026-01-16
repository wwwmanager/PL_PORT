/**
 * Zod validation schema for Vehicle
 * Separated from component for reusability and testing
 */

import { z } from 'zod';
import { VehicleStatus } from '../../types';
import {
    normalizePlate,
    normalizeVin,
    emptyToNull,
    validatePlateNumber,
    validateVin,
    validateBodyNumber,
    validateChassisNumber,
} from '../../shared/validation/vehicle';
import { getAllowedCategories } from '../../shared/vehicleCategoryMap';

// Helper schemas
const fuelConsumptionRatesSchema = z.object({
    summerRate: z.number().positive('Норма должна быть > 0'),
    winterRate: z.number().positive('Норма должна быть > 0'),
    cityIncreasePercent: z.number().min(0, "Надбавка не может быть отрицательной").nullish(),
    warmingIncreasePercent: z.number().min(0, "Надбавка не может быть отрицательной").nullish(),
});

const maintenanceRecordSchema = z.object({
    id: z.string().optional(),
    date: z.string().min(1, "Дата обязательна"),
    workType: z.string().min(1, "Тип работ обязателен"),
    mileage: z.number().min(0),
    description: z.string().optional().nullable(),
    performer: z.string().optional().nullable(),
    cost: z.number().optional().nullable(),
});

// Main vehicle schema with preprocessing for normalization
export const vehicleSchema = z.object({
    id: z.string().optional(),

    // Plate number - strict validation after normalization
    plateNumber: z.preprocess(
        normalizePlate,
        z.string().min(1, "Гос. номер обязателен").superRefine((val, ctx) => {
            const error = validatePlateNumber(val);
            if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
        })
    ),

    brand: z.string().min(1, "Марка/модель обязательна"),

    // VIN - soft validation (optional, but if provided must be valid)
    vin: z.preprocess(
        (val) => emptyToNull(normalizeVin(val)),
        z.string().superRefine((val, ctx) => {
            const error = validateVin(val);
            if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
        }).nullable().optional()
    ),

    // Vehicle category - driver license or UTM
    vehicleCategory: z.enum([
        'M', 'A', 'A1', 'B', 'B1', 'C', 'C1', 'D', 'D1',
        'BE', 'CE', 'C1E', 'DE', 'D1E', 'Tm', 'Tb',
        'AI', 'AII', 'A3', 'A4', 'E', 'F'
    ]).nullable().optional(),

    // Body number - soft validation
    bodyNumber: z.preprocess(
        emptyToNull,
        z.string().superRefine((val, ctx) => {
            const error = validateBodyNumber(val);
            if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
        }).nullable().optional()
    ),

    // Chassis number - soft validation
    chassisNumber: z.preprocess(
        emptyToNull,
        z.string().superRefine((val, ctx) => {
            const error = validateChassisNumber(val);
            if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
        }).nullable().optional()
    ),

    mileage: z.number().min(0, "Пробег не может быть отрицательным"),
    fuelTypeId: z.string().min(1, "Тип топлива обязателен"),
    fuelConsumptionRates: fuelConsumptionRatesSchema,
    assignedDriverId: z.string().nullable(),
    organizationId: z.string().optional().nullable(),
    currentFuel: z.number().min(0).optional().nullable(),
    year: z.number().optional().nullable(),
    vehicleType: z.enum(['Легковой', 'Тягач', 'Прицеп', 'Автобус', 'Спецтехника']).optional().nullable(),
    status: z.nativeEnum(VehicleStatus),
    notes: z.string().optional().nullable(),

    // PTS fields
    ptsType: z.enum(['PTS', 'EPTS']).optional().nullable(),
    ptsSeries: z.string().optional().nullable(),
    ptsNumber: z.string().optional().nullable(),
    eptsNumber: z.string().optional().nullable(),

    // Diagnostic card
    diagnosticCardNumber: z.string().optional().nullable(),
    diagnosticCardIssueDate: z.string().optional().nullable(),
    diagnosticCardExpiryDate: z.string().optional().nullable(),

    // Maintenance
    maintenanceHistory: z.array(maintenanceRecordSchema).optional().nullable(),
    useCityModifier: z.boolean().optional(),
    useWarmingModifier: z.boolean().optional(),
    fuelTankCapacity: z.number().min(0).optional().nullable(),
    disableFuelCapacityCheck: z.boolean().optional(),

    // OSAGO
    osagoSeries: z.string().optional().nullable(),
    osagoNumber: z.string().optional().nullable(),
    osagoStartDate: z.string().optional().nullable(),
    osagoEndDate: z.string().optional().nullable(),

    // Storage
    storageLocationId: z.string().optional().nullable(),

    // Maintenance intervals
    maintenanceIntervalKm: z.number().min(0).optional().nullable(),
    lastMaintenanceMileage: z.number().min(0).optional().nullable(),
}).superRefine((data, ctx) => {
    // Cross-field validation: vehicleCategory must be allowed for vehicleType
    if (data.vehicleType && data.vehicleCategory) {
        const allowed = getAllowedCategories(data.vehicleType);

        if (!allowed.includes(data.vehicleCategory)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['vehicleCategory'],
                message: `Категория "${data.vehicleCategory}" не разрешена для типа "${data.vehicleType}"`
            });
        }
    }

    // Block deprecated Tm/Tb categories
    if (data.vehicleCategory === 'Tm' || data.vehicleCategory === 'Tb') {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['vehicleCategory'],
            message: 'Категории Tm/Tb больше не поддерживаются'
        });
    }
});

export type VehicleFormData = z.infer<typeof vehicleSchema>;
