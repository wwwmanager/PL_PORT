
import React from 'react';
import { ArrowDownIcon, ArrowUpIcon } from '../Icons';

const CollapsibleSection: React.FC<{
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, isCollapsed, onToggle, children }) => (
  <div className={`bg-white dark:bg-gray-700/50 rounded-lg shadow-sm transition-all duration-300 border border-gray-200 dark:border-gray-600 ${isCollapsed ? 'overflow-hidden' : 'overflow-visible'}`}>
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex justify-between items-center p-4 text-left bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isCollapsed ? 'rounded-lg' : 'rounded-t-lg'}`}
      aria-expanded={!isCollapsed}
    >
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h3>
      {isCollapsed ? <ArrowDownIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" /> : <ArrowUpIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />}
    </button>
    <div
      className={`bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 transition-all duration-300 overflow-hidden ${isCollapsed
          ? 'max-h-0 opacity-0'
          : 'max-h-[2000px] opacity-100 p-6 border-t rounded-b-lg'
        }`}
      aria-hidden={isCollapsed}
    >
      {children}
    </div>
  </div>
);

export default CollapsibleSection;
