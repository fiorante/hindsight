import React, { useState } from 'react'
import { DriveResultView } from './DriveResultView'
import { useDriveState } from '../providers/DriveStateProvider'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

interface Drive {
  id: string
  title: string
  description: string
  thumbnail: string
  isReference?: boolean
}

interface SearchResultsProps {
  drives: Drive[]
  hasSearched?: boolean
  pageSize?: number
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  drives,
  hasSearched = false,
  pageSize = 10
}) => {
  const { selectedDrives, toggleDriveSelection } = useDriveState()
  const [currentPage, setCurrentPage] = useState(1)

  const handleDriveClick = (driveId: string) => toggleDriveSelection(driveId)

  // Calculate pagination
  const totalPages = Math.ceil(drives.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const currentDrives = drives.slice(startIndex, endIndex)

  // Reset to first page when drives change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [drives.length])

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const renderPagination = () => {
    if (totalPages <= 1) return null

    const getPageNumbers = () => {
      const pages = []
      const maxVisiblePages = 5

      if (totalPages <= maxVisiblePages) {
        // Show all pages if total is small
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        // Show smart pagination with ellipsis
        if (currentPage <= 3) {
          // Near start: show 1, 2, 3, 4, 5, ..., last
          for (let i = 1; i <= 5; i++) {
            pages.push(i)
          }
          pages.push('...')
          pages.push(totalPages)
        } else if (currentPage >= totalPages - 2) {
          // Near end: show 1, ..., last-4, last-3, last-2, last-1, last
          pages.push(1)
          pages.push('...')
          for (let i = totalPages - 4; i <= totalPages; i++) {
            pages.push(i)
          }
        } else {
          // Middle: show 1, ..., current-1, current, current+1, ..., last
          pages.push(1)
          pages.push('...')
          pages.push(currentPage - 1)
          pages.push(currentPage)
          pages.push(currentPage + 1)
          pages.push('...')
          pages.push(totalPages)
        }
      }

      return pages
    }

    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-stellar-dark-border bg-gray-50 dark:bg-stellar-dark-background">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700 dark:text-stellar-dark-text-secondary">
            Showing {startIndex + 1}-{Math.min(endIndex, drives.length)} of {drives.length} results
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-stellar-dark-surface disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>

          {getPageNumbers().map((page, index) => (
            <React.Fragment key={index}>
              {page === '...' ? (
                <span className="px-2 text-gray-500 dark:text-stellar-dark-text-secondary">...</span>
              ) : (
                <button
                  onClick={() => handlePageChange(page as number)}
                  className={`px-2 py-1 text-sm rounded ${currentPage === page
                    ? 'bg-gray-900 dark:bg-stellar-cta text-white dark:text-black'
                    : 'text-gray-700 dark:text-stellar-dark-text-secondary hover:bg-gray-200 dark:hover:bg-stellar-dark-surface'
                    }`}
                >
                  {page}
                </button>
              )}
            </React.Fragment>
          ))}

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-stellar-dark-surface disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1">
        {currentDrives.map((drive, index) => {
          const isSelected = selectedDrives.includes(drive.id)
          return (
            <React.Fragment key={drive.id}>
              <DriveResultView
                drive={drive}
                isSelected={isSelected}
                onClick={() => handleDriveClick(drive.id)}
              />
              {index < currentDrives.length - 1 && (
                <div className="border-b border-gray-200 dark:border-stellar-dark-border"></div>
              )}
            </React.Fragment>
          )
        })}
        {drives.length === 0 && hasSearched && (
          <div className="text-center py-10 text-gray-500 dark:text-stellar-dark-text-secondary">
            <div className="text-sm font-medium mb-1">No results found</div>
            <div className="text-xs">Try adjusting your filters or search parameters.</div>
          </div>
        )}
      </div>

      {renderPagination()}
    </div>
  )
}
