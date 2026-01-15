
import { Vehicle, Employee } from '../../types';
import { createRepo, ListQuery } from '../repo';
import { DB_KEYS } from '../dbKeys';
import { normalizePlate, normalizeVin, emptyToNull } from '../../shared/validation/vehicle';

/**
 * Migration function for vehicles
 * Adds new fields and normalizes existing data
 */
function migrateVehicle(item: any): { item: Vehicle; changed: boolean } {
    let changed = false;

    // Add vehicleCategory if missing
    if (!item.vehicleCategory) {
        item.vehicleCategory = 'UNKNOWN';
        changed = true;
    }

    // Normalize plate number
    if (item.plateNumber) {
        const normalized = normalizePlate(item.plateNumber);
        if (normalized !== item.plateNumber) {
            item.plateNumber = normalized;
            changed = true;
        }
    }

    // Normalize VIN
    const normalizedVin = emptyToNull(normalizeVin(item.vin));
    if (normalizedVin !== item.vin) {
        item.vin = normalizedVin;
        changed = true;
    }

    // Normalize body number
    const normalizedBody = emptyToNull(item.bodyNumber);
    if (normalizedBody !== item.bodyNumber) {
        item.bodyNumber = normalizedBody;
        changed = true;
    }

    // Normalize chassis number
    const normalizedChassis = emptyToNull(item.chassisNumber);
    if (normalizedChassis !== item.chassisNumber) {
        item.chassisNumber = normalizedChassis;
        changed = true;
    }

    return { item: item as Vehicle, changed };
}

/**
 * Normalization function applied on write operations
 */
function normalizeVehicleOnWrite(v: Vehicle): Vehicle {
    return {
        ...v,
        plateNumber: normalizePlate(v.plateNumber),
        vin: emptyToNull(normalizeVin(v.vin)),
        bodyNumber: emptyToNull(v.bodyNumber),
        chassisNumber: emptyToNull(v.chassisNumber),
        // Don't set default category, let it be null
    };
}

const vehicleRepo = createRepo<Vehicle>(DB_KEYS.VEHICLES, {
    migrate: migrateVehicle,
    normalizeOnWrite: normalizeVehicleOnWrite,
});
const employeeRepo = createRepo<Employee>(DB_KEYS.EMPLOYEES);

export const getVehicles = async () => (await vehicleRepo.list({ pageSize: 1000 })).data;
export const fetchVehicles = async (q: ListQuery) => vehicleRepo.list(q);
export const addVehicle = (item: Omit<Vehicle, 'id'>) => vehicleRepo.create(item);
export const updateVehicle = (item: Vehicle) => vehicleRepo.update(item.id, item);
export const deleteVehicle = (id: string) => vehicleRepo.remove(id);

export const getIssues = async (params: { vehicleId?: string }) => {
    const vehicles = (await vehicleRepo.list({ pageSize: 1000 })).data;
    const employees = (await employeeRepo.list({ pageSize: 1000 })).data;

    const targets = params.vehicleId ? vehicles.filter(v => v.id === params.vehicleId) : vehicles;

    const expiringDocs: Array<{ type: string; name: string; date: string }> = [];
    const now = new Date();
    const warningThreshold = new Date();
    warningThreshold.setDate(now.getDate() + 30); // Предупреждать за 30 дней

    // 1. Проверка ТС
    for (const v of targets) {
        if (v.status !== 'Active') continue;

        // Check OSAGO
        if (v.osagoEndDate) {
            const date = new Date(v.osagoEndDate);
            if (date <= warningThreshold) {
                expiringDocs.push({
                    type: 'ОСАГО',
                    name: `${v.plateNumber} (${v.brand})`,
                    date: v.osagoEndDate
                });
            }
        }

        // Check Diagnostic Card
        if (v.diagnosticCardExpiryDate) {
            const date = new Date(v.diagnosticCardExpiryDate);
            if (date <= warningThreshold) {
                expiringDocs.push({
                    type: 'Диагностическая карта',
                    name: `${v.plateNumber} (${v.brand})`,
                    date: v.diagnosticCardExpiryDate
                });
            }
        }

        // Check Maintenance
        if (v.maintenanceIntervalKm && v.lastMaintenanceMileage !== undefined && v.lastMaintenanceMileage !== null) {
            const nextService = v.lastMaintenanceMileage + v.maintenanceIntervalKm;
            const remaining = nextService - v.mileage;
            if (remaining <= 1000) {
                expiringDocs.push({
                    type: 'Тех. обслуживание',
                    name: `${v.plateNumber} (${v.brand}): ${remaining < 0 ? `Просрочено на ${Math.abs(remaining)} км` : `Осталось ${remaining} км`}`,
                    date: new Date().toISOString()
                });
            }
        }
    }

    // 2. Проверка водителей (ВУ и Медсправки)
    let targetDrivers = employees.filter(e => e.status === 'Active' && e.employeeType === 'driver');

    // Если выбран конкретный автомобиль, проверяем только закрепленного водителя
    if (params.vehicleId) {
        const vehicle = vehicles.find(v => v.id === params.vehicleId);
        if (vehicle && vehicle.assignedDriverId) {
            targetDrivers = targetDrivers.filter(d => d.id === vehicle.assignedDriverId);
        } else {
            // Если у машины нет закрепленного водителя, водителей не проверяем
            targetDrivers = [];
        }
    }

    for (const d of targetDrivers) {
        // Водительское удостоверение
        if (d.documentExpiry) {
            const date = new Date(d.documentExpiry);
            if (date <= warningThreshold) {
                expiringDocs.push({
                    type: 'Водительское удостоверение',
                    name: d.shortName,
                    date: d.documentExpiry
                });
            }
        }

        // Медицинская справка
        if (d.medicalCertificateExpiryDate) {
            const date = new Date(d.medicalCertificateExpiryDate);
            if (date <= warningThreshold) {
                expiringDocs.push({
                    type: 'Медицинская справка',
                    name: d.shortName,
                    date: d.medicalCertificateExpiryDate
                });
            }
        }
    }

    return { expiringDocs };
};
