import React, { useState, useEffect, lazy, Suspense } from 'react';
import FuelTypeManagement from '../admin/FuelTypeManagement';
import OrganizationManagement from '../admin/OrganizationManagement'; // Import default
import { VehicleList } from '../vehicles/VehicleList';
import EmployeeList from '../employees/EmployeeList';
import RouteManagement from './RouteManagement';
import { DictionaryType } from '../../types';
import { useAuth } from '../../services/auth';

const GarageManagement = lazy(() => import('./GarageManagement'));
const StorageManagement = lazy(() => import('./StorageManagement'));
const ProductionCalendarSettings = lazy(() => import('../admin/ProductionCalendarSettings'));

interface DictionariesProps {
    subViewToOpen?: DictionaryType | null;
}

const Dictionaries: React.FC<DictionariesProps> = ({ subViewToOpen }) => {
    const { can } = useAuth();
    
    const allDicts: { type: DictionaryType; label: string; }[] = [
        { type: 'vehicles', label: 'Транспорт' },
        { type: 'employees', label: 'Сотрудники' },
        { type: 'organizations', label: 'Организации' },
        { type: 'fuelTypes', label: 'Топливо' },
        { type: 'storageLocations', label: 'Склады' },
        { type: 'routes', label: 'Маршруты' },
        { type: 'calendar', label: 'Календарь' },
    ];

    const [activeDictionary, setActiveDictionary] = useState<DictionaryType>(allDicts[0]?.type || 'vehicles');

    useEffect(() => {
        const handleNavigate = (event: CustomEvent) => {
            const { view, subView } = event.detail;
            if (view === 'DICTIONARIES' && subView) {
                setActiveDictionary(subView);
            }
        };

        document.addEventListener('navigateTo', handleNavigate as EventListener);

        if (subViewToOpen) {
            setActiveDictionary(subViewToOpen);
        }

        return () => {
            document.removeEventListener('navigateTo', handleNavigate as EventListener);
        };
    }, [subViewToOpen]);
    
    const renderActiveDictionary = () => {
        switch(activeDictionary) {
            case 'fuelTypes': return <FuelTypeManagement />;
            case 'organizations': return <OrganizationManagement />;
            case 'vehicles': return <VehicleList />;
            case 'employees': return <EmployeeList />;
            case 'storageLocations': return <Suspense fallback={<div>Загрузка...</div>}><StorageManagement /></Suspense>;
            case 'routes': return <RouteManagement />;
            case 'calendar': return <Suspense fallback={<div>Загрузка...</div>}><ProductionCalendarSettings readOnly={!can('admin.panel')} /></Suspense>;
            default: return <div className="p-8 text-center text-gray-500">Выберите справочник.</div>;
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col min-h-[600px]">
            {/* Tabs Header */}
            <div className="border-b border-gray-200 dark:border-gray-700 px-2 overflow-x-auto">
                <div className="flex space-x-1">
                    {allDicts.map(dict => (
                        <button 
                            key={dict.type}
                            onClick={() => setActiveDictionary(dict.type)} 
                            className={`px-5 py-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap focus:outline-none ${
                                activeDictionary === dict.type 
                                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
                            }`}
                        >
                            {dict.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="p-6 flex-1 overflow-x-auto">
                <Suspense fallback={
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                        Загрузка компонента...
                    </div>
                }>
                    {renderActiveDictionary()}
                </Suspense>
            </div>
        </div>
    );
};

export default Dictionaries;