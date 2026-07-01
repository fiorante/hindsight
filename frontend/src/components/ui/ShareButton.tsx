import React, { useState } from 'react';
import { Share2Icon, CheckIcon, CopyIcon } from 'lucide-react';
import { useAppStore } from '../../state/store';

interface ShareButtonProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  className = '',
  size = 'md'
}) => {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const generateShareableUrl = useAppStore((state) => state.generateShareableUrl);
  const copyUrlToClipboard = useAppStore((state) => state.copyUrlToClipboard);

  const handleShare = async () => {
    try {
      const success = await copyUrlToClipboard();

      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Fallback: show the URL in a prompt
        const shareableUrl = generateShareableUrl();
        if (navigator.share) {
          await navigator.share({
            title: 'Hindsight - Mars Rover Data Visualization',
            url: shareableUrl,
          });
        } else {
          // Last resort: show URL in alert
          alert(`Share this URL:\n${shareableUrl}`);
        }
      }
    } catch (error) {
      console.error('Failed to share:', error);
      // Fallback for any errors
      const shareableUrl = generateShareableUrl();
      prompt('Copy this URL to share:', shareableUrl);
    }
  };

  const sizeClasses = {
    sm: 'p-1.5 text-sm',
    md: 'p-2 text-base',
    lg: 'p-3 text-lg',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <div className="relative">
      <button
        onClick={handleShare}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          ${sizeClasses[size]}
          ${className}
          bg-white dark:bg-stellar-dark-surface
          text-gray-600 dark:text-stellar-dark-text-secondary
          hover:bg-gray-100 dark:hover:bg-stellar-dark-surface-elevated
          hover:text-gray-900 dark:hover:text-stellar-dark-text-primary
          rounded-full shadow-md
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${copied ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400' : ''}
        `}
        title="Share current view"
        disabled={copied}
      >
        {copied ? (
          <CheckIcon className={iconSizes[size]} />
        ) : (
          <Share2Icon className={iconSizes[size]} />
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && !copied && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded whitespace-nowrap z-50">
          Share current view
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
        </div>
      )}

      {/* Success tooltip */}
      {copied && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-green-600 text-white rounded whitespace-nowrap z-50">
          URL copied!
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-green-600"></div>
        </div>
      )}
    </div>
  );
};
