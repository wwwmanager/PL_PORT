
import React, { useState, useEffect } from 'react';
import Modal from '../shared/Modal';
import { ExcelWaybillRow, parseExcelWaybills } from '../../services/excelImportService';
import { Vehicle, Employee, Waybill, WaybillStatus, Organization, WaybillBlank } from '../../types';
import { getVehicles, getEmployees, getOrganizations, addWaybill, getBlanks, reserveBlank } from '../../services/mockApi';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../services/auth';
import { UploadIcon, ExclamationCircleIcon } from '../Icons';
import { AlertTriangle, Hash, X } from 'lucide-react';

interface ExcelImportModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ onClose, onSuccess }) => {
    const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
    const [parsedRows, setParsedRows] = useState<ExcelWaybillRow[]>([]);

    // Selection
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);

    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [selectedDriverId, setSelectedDriverId] = useState('');
    const [selectedDispatcherId, setSelectedDispatcherId] = useState('');
    const [selectedControllerId, setSelectedControllerId] = useState('');
    const [statusToSet, setStatusToSet] = useState<WaybillStatus>(WaybillStatus.DRAFT);

    // Checkbox selections for rows
    const [selectedRowIndexes, setSelectedRowIndexes] = useState<Set<number>>(new Set());

    const { showToast } = useToast();
    const { currentUser } = useAuth();

    // Blank shortage dialog
    const [blankShortage, setBlankShortage] = useState<{ available: number; required: number; shortage: number } | null>(null);
    const [useAutoNumbers, setUseAutoNumbers] = useState(false);

    useEffect(() => {
        Promise.all([getVehicles(), getEmployees(), getOrganizations()]).then(([v, e, o]) => {
            setVehicles(v.filter(veh => veh.status === 'Active'));
            setEmployees(e.filter(emp => emp.status === 'Active'));
            setOrganizations(o);
        });
    }, []);

    // Auto-select based on vehicle
    useEffect(() => {
        if (selectedVehicleId) {
            const v = vehicles.find(x => x.id === selectedVehicleId);
            if (v && v.assignedDriverId) {
                setSelectedDriverId(v.assignedDriverId);
            }
        }
    }, [selectedVehicleId, vehicles]);

    // Auto-select staff based on driver
    useEffect(() => {
        if (selectedDriverId) {
            const driver = employees.find(e => e.id === selectedDriverId);
            if (driver) {
                if (driver.dispatcherId) setSelectedDispatcherId(driver.dispatcherId);
                if (driver.controllerId) setSelectedControllerId(driver.controllerId);
            }
        }
    }, [selectedDriverId, employees]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const rows = await parseExcelWaybills(file);
            if (rows.length === 0) {
                showToast('Файл пуст или не содержит распознаваемых данных.', 'error');
                return;
            }
            setParsedRows(rows);
            // Select all valid rows by default
            setSelectedRowIndexes(new Set(rows.map((_, i) => i)));
            setStep('preview');
        } catch (err: any) {
            console.error(err);
            showToast('Ошибка чтения файла: ' + err.message, 'error');
        }
    };

    const handleImport = async (forceAutoNumbers: boolean = false) => {
        if (!selectedVehicleId || !selectedDriverId) {
            showToast('Выберите автомобиль и водителя.', 'error');
            return;
        }

        if (selectedRowIndexes.size === 0) {
            showToast('Выберите строки для импорта.', 'info');
            return;
        }

        const rowsToImport = parsedRows.filter((_, i) => selectedRowIndexes.has(i));
        const requiredCount = rowsToImport.length;

        // Check blank availability (unless user chose to use auto numbers)
        if (!forceAutoNumbers && !useAutoNumbers) {
            const allBlanks = await getBlanks();
            const availableBlanks = allBlanks.filter(
                b => b.ownerEmployeeId === selectedDriverId && b.status === 'issued'
            );

            if (availableBlanks.length < requiredCount) {
                setBlankShortage({
                    available: availableBlanks.length,
                    required: requiredCount,
                    shortage: requiredCount - availableBlanks.length
                });
                return;
            }
        }

        setStep('importing');
        setBlankShortage(null);

        const driver = employees.find(e => e.id === selectedDriverId)!;
        const orgId = driver.organizationId || organizations[0]?.id || '';

        try {
            // Fetch blanks for assignment
            const allBlanks = await getBlanks();
            const availableBlanks = allBlanks
                .filter(b => b.ownerEmployeeId === selectedDriverId && b.status === 'issued')
                .sort((a, b) => a.series.localeCompare(b.series) || a.number - b.number);

            let blankIndex = 0;
            let importedCount = 0;

            for (const row of rowsToImport) {
                // Try to use a blank
                let waybillNumber = '';
                let blankId: string | undefined;

                if (!forceAutoNumbers && !useAutoNumbers && availableBlanks[blankIndex]) {
                    const blank = availableBlanks[blankIndex];
                    waybillNumber = `${blank.series} ${String(blank.number).padStart(6, '0')}`;

                    // Reserve the blank
                    try {
                        await reserveBlank(blank.id, 'temp-waybill-id');
                        blankId = blank.id;
                        blankIndex++;
                    } catch (e) {
                        console.error('Failed to reserve blank:', e);
                        // Fall back to auto number
                        waybillNumber = '';
                    }
                }

                const payload: Omit<Waybill, 'id'> & { blankId?: string } = {
                    number: waybillNumber, // Will be auto-generated if empty
                    date: row.date,
                    vehicleId: selectedVehicleId,
                    driverId: selectedDriverId,
                    organizationId: orgId,
                    dispatcherId: selectedDispatcherId,
                    controllerId: selectedControllerId,
                    status: statusToSet,

                    odometerStart: row.odometerStart,
                    odometerEnd: row.odometerEnd,
                    fuelAtStart: row.fuelAtStart,
                    fuelAtEnd: row.fuelAtEnd,
                    fuelFilled: row.fuelFilled,
                    fuelPlanned: row.fuelPlanned > 0 ? row.fuelPlanned : Math.max(0, row.fuelAtStart + row.fuelFilled - row.fuelAtEnd),

                    routes: row.routes,

                    validFrom: row.validFrom,
                    validTo: row.validTo,
                    notes: 'Импорт из Excel',
                    calculationMethod: 'by_total',
                    blankId: blankId
                };

                await addWaybill(payload as any, { userId: currentUser?.id });
                importedCount++;
            }

            showToast(`Успешно импортировано ${importedCount} путевых листов.`, 'success');
            onSuccess();
            onClose();
        } catch (e: any) {
            showToast('Ошибка при импорте: ' + e.message, 'error');
            setStep('preview');
        }
    };

    const handleUseAutoNumbers = () => {
        setUseAutoNumbers(true);
        setBlankShortage(null);
        handleImport(true);
    };

    const handleCancelBlankDialog = () => {
        setBlankShortage(null);
    };

    const renderBlankShortageDialog = () => {
        if (!blankShortage) return null;

        const driverName = employees.find(e => e.id === selectedDriverId)?.shortName || 'водителя';

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                                <AlertTriangle className="w-6 h-6 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Недостаточно бланков
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Для импорта путевых листов
                                </p>
                            </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-300">Необходимо ПЛ:</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{blankShortage.required}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-300">Бланков у {driverName}:</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{blankShortage.available}</span>
                            </div>
                            <div className="border-t dark:border-gray-600 pt-2 flex justify-between text-sm">
                                <span className="text-red-600 dark:text-red-400 font-medium">Не хватает:</span>
                                <span className="font-bold text-red-600 dark:text-red-400">{blankShortage.shortage}</span>
                            </div>
                        </div>

                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                            Выберите действие:
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={handleUseAutoNumbers}
                                className="w-full flex items-center gap-3 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left"
                            >
                                <Hash className="w-5 h-5 text-blue-600" />
                                <div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                        Использовать автоматические номера
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        ПЛ будут созданы с системной нумерацией
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={handleCancelBlankDialog}
                                className="w-full flex items-center gap-3 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                                <div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                        Отмена
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        Вернуться к предпросмотру и выдать бланки вручную
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const toggleRow = (idx: number) => {
        const newSet = new Set(selectedRowIndexes);
        if (newSet.has(idx)) newSet.delete(idx);
        else newSet.add(idx);
        setSelectedRowIndexes(newSet);
    };

    const renderUploadStep = () => (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
            <UploadIcon className="h-16 w-16 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Загрузите Excel файл</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">
                Поддерживаются форматы .xlsx, .xls. <br />
                Структура: Дата, Время, Пробег (нач/кон), Топливо, Пункт 1...Пункт N.
            </p>
            <label className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-md">
                Выбрать файл
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
            </label>
        </div>
    );

    const renderPreviewStep = () => (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Toolbar */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 border-b dark:border-gray-700 flex-shrink-0">
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Автомобиль *</label>
                    <select className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)}>
                        <option value="">Выберите ТС</option>
                        {vehicles.map(v => <option key={v.id} value={v.id}>{v.plateNumber} ({v.brand})</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Водитель *</label>
                    <select className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)}>
                        <option value="">Выберите водителя</option>
                        {employees.filter(e => e.employeeType === 'driver').map(e => <option key={e.id} value={e.id}>{e.shortName}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Диспетчер</label>
                    <select className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={selectedDispatcherId} onChange={e => setSelectedDispatcherId(e.target.value)}>
                        <option value="">Выберите диспетчера</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.shortName}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Статус создания</label>
                    <select className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={statusToSet} onChange={e => setStatusToSet(e.target.value as WaybillStatus)}>
                        <option value={WaybillStatus.DRAFT}>Черновик</option>
                        <option value={WaybillStatus.POSTED}>Проведено</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="flex-grow overflow-auto p-4">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="p-2 border dark:border-gray-700 text-center w-10">
                                <input
                                    type="checkbox"
                                    checked={selectedRowIndexes.size === parsedRows.length}
                                    onChange={e => setSelectedRowIndexes(e.target.checked ? new Set(parsedRows.map((_, i) => i)) : new Set())}
                                />
                            </th>
                            <th className="p-2 border dark:border-gray-700">Дата / Время</th>
                            <th className="p-2 border dark:border-gray-700">Маршрут</th>
                            <th className="p-2 border dark:border-gray-700 text-right">Пробег</th>
                            <th className="p-2 border dark:border-gray-700 text-right">Заправка</th>
                            <th className="p-2 border dark:border-gray-700 text-right">Норма</th>
                            <th className="p-2 border dark:border-gray-700 text-right">Остаток</th>
                            <th className="p-2 border dark:border-gray-700">Инфо</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {parsedRows.map((row, idx) => {
                            const timeStr = row.validFrom.split('T')[1];
                            const retTimeStr = row.validTo.split('T')[1];
                            return (
                                <tr key={idx} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${!selectedRowIndexes.has(idx) ? 'opacity-50' : ''}`}>
                                    <td className="p-2 border dark:border-gray-700 text-center">
                                        <input type="checkbox" checked={selectedRowIndexes.has(idx)} onChange={() => toggleRow(idx)} />
                                    </td>
                                    <td className="p-2 border dark:border-gray-700 whitespace-nowrap">
                                        <div>{new Date(row.date).toLocaleDateString()}</div>
                                        <div className="text-xs text-gray-500">{timeStr} - {retTimeStr}</div>
                                    </td>
                                    <td className="p-2 border dark:border-gray-700 max-w-xs truncate">
                                        <span className="font-semibold">{row.routes.length} сегментов:</span><br />
                                        <span className="text-xs text-gray-500" title={row.routes.map(r => `${r.from}->${r.to}`).join('; ')}>
                                            {row.routes.length > 0 ? `${row.routes[0].from} → ${row.routes[row.routes.length - 1].to}` : 'Н/Д'}
                                        </span>
                                    </td>
                                    <td className="p-2 border dark:border-gray-700 text-right">{(row.odometerEnd - row.odometerStart).toFixed(0)} км</td>
                                    <td className="p-2 border dark:border-gray-700 text-right font-semibold">{row.fuelFilled > 0 ? row.fuelFilled : '-'}</td>
                                    <td className="p-2 border dark:border-gray-700 text-right">{row.fuelPlanned > 0 ? row.fuelPlanned.toFixed(1) : '-'}</td>
                                    <td className="p-2 border dark:border-gray-700 text-right">{row.fuelAtEnd.toFixed(1)}</td>
                                    <td className="p-2 border dark:border-gray-700">
                                        {row.warnings.length > 0 && (
                                            <div className="flex items-center gap-1 text-orange-600 text-xs" title={row.warnings.join(', ')}>
                                                <ExclamationCircleIcon className="h-4 w-4" />
                                                {row.warnings[0]}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300">
                Выбрано строк: <b>{selectedRowIndexes.size}</b> из {parsedRows.length}
            </div>
        </div>
    );

    return (
        <>
            <Modal
                isOpen={true}
                onClose={onClose}
                title="Импорт из Excel"
                footer={
                    <>
                        <button onClick={step === 'upload' ? onClose : () => setStep('upload')} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
                            {step === 'upload' ? 'Отмена' : 'Назад'}
                        </button>
                        {step === 'preview' && (
                            <button
                                onClick={() => handleImport()}
                                disabled={selectedRowIndexes.size === 0 || !selectedVehicleId || !selectedDriverId}
                                className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                            >
                                Импортировать
                            </button>
                        )}
                    </>
                }
            >
                <div className="h-[500px] flex flex-col">
                    {step === 'upload' && renderUploadStep()}
                    {step === 'preview' && renderPreviewStep()}
                    {step === 'importing' && (
                        <div className="flex flex-col items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                            <p className="text-gray-600 dark:text-gray-300">Импорт данных...</p>
                        </div>
                    )}
                </div>
            </Modal>
            {renderBlankShortageDialog()}
        </>
    );
};

export default ExcelImportModal;
