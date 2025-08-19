// src/pages/CardSearch.js - Card Search and Tracking
import React, { useState } from 'react';
import { useMutation } from 'react-query';
import { Search, CreditCard, Phone, MapPin, Calendar, Activity, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cardAPI } from '../services/api';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import toast from 'react-hot-toast';

const CardSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Search mutation
  const searchMutation = useMutation(
    (query) => cardAPI.search(query),
    {
      onSuccess: (response) => {
        const data = response.data;
        if (data.success) {
          setSearchResults(data.data);
          // If single result, select it automatically
          if (!Array.isArray(data.data)) {
            setSelectedCard(data.data);
          }
          toast.success(`Found ${data.count || 1} card(s)`);
        }
      },
      onError: (error) => {
        console.error('Search error:', error);
        setSearchResults(null);
        setSelectedCard(null);
      }
    }
  );

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.length < 3) {
      toast.error('Please enter at least 3 characters');
      return;
    }

    setIsLoading(true);
    try {
      await searchMutation.mutateAsync(searchQuery.trim());
    } finally {
      setIsLoading(false);
    }
  };

  const selectCard = (card) => {
    setSelectedCard(card);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'DELIVERED':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'IN_TRANSIT':
      case 'OUT_FOR_DELIVERY':
        return <Activity className="w-5 h-5 text-blue-600 animate-pulse" />;
      case 'DELIVERY_FAILED':
      case 'EMBOSSING_FAILED':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'APPROVED': 'bg-blue-100 text-blue-800 border-blue-200',
      'QUEUED_FOR_EMBOSSING': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'IN_EMBOSSING': 'bg-orange-100 text-orange-800 border-orange-200',
      'EMBOSSING_COMPLETE': 'bg-green-100 text-green-800 border-green-200',
      'EMBOSSING_FAILED': 'bg-red-100 text-red-800 border-red-200',
      'DISPATCHED': 'bg-blue-100 text-blue-800 border-blue-200',
      'IN_TRANSIT': 'bg-purple-100 text-purple-800 border-purple-200',
      'OUT_FOR_DELIVERY': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'DELIVERED': 'bg-green-100 text-green-800 border-green-200',
      'DELIVERY_FAILED': 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Pending';
    return new Date(timestamp).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Track Your Card</h1>
        <p className="text-gray-600">Search by Card ID, Mobile Number, PAN, or Customer Name</p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <form onSubmit={handleSearch} className="flex space-x-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Enter Card ID, Mobile Number, PAN (last 4 digits), or Customer Name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <Search className="absolute right-3 top-3.5 w-5 h-5 text-gray-400" />
          </div>
          <button
            type="submit"
            disabled={isLoading || !searchQuery.trim()}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isLoading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <Search className="w-5 h-5 mr-2" />
                Search
              </>
            )}
          </button>
        </form>

        {/* Search Examples */}
        <div className="mt-4 text-sm text-gray-500">
          <p className="mb-2">Examples:</p>
          <div className="flex flex-wrap gap-2">
            {['CRD001234', '****-****-****-1234', 'John Doe', '9876543210'].map((example) => (
              <button
                key={example}
                onClick={() => setSearchQuery(example)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Results */}
      {searchResults && Array.isArray(searchResults) && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Search Results ({searchResults.length})
          </h3>
          <div className="space-y-3">
            {searchResults.map((card) => (
              <div
                key={card.cardId}
                onClick={() => selectCard(card)}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{card.cardId}</p>
                    <p className="text-sm text-gray-600">{card.customerName}</p>
                    <p className="text-xs text-gray-500">{card.mobileDisplay}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(card.currentStatus)}`}>
                      {card.currentStatus.replace(/_/g, ' ')}
                    </span>
                    {card.priority === 'EXPRESS' && (
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          ⚡ EXPRESS
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Card Details */}
      {selectedCard && (
        <div className="space-y-6">
          {/* Card Information */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedCard.customerName}</h3>
                  <p className="text-sm text-gray-500">Card ID: {selectedCard.cardId}</p>
                  <p className="text-sm text-gray-500">Customer ID: {selectedCard.customerId}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedCard.currentStatus)}`}>
                  {selectedCard.currentStatus.replace(/_/g, ' ')}
                </span>
                {selectedCard.priority === 'EXPRESS' && (
                  <div className="mt-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                      ⚡ EXPRESS
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Mobile</p>
                  <p className="font-medium">{selectedCard.mobileDisplay}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">PAN</p>
                  <p className="font-medium">{selectedCard.panMasked}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium">{selectedCard.addressDisplay || 'On file'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Est. Delivery</p>
                  <p className="font-medium">{formatTimestamp(selectedCard.estimatedDelivery)}</p>
                </div>
              </div>
            </div>

            {selectedCard.failureReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                  <p className="text-sm text-red-800">
                    <strong>Issue:</strong> {selectedCard.failureReason}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Journey Timeline */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Journey Timeline</h3>
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              <div className="space-y-6">
                {selectedCard.journey?.map((step, index) => (
                  <div key={index} className="flex items-start relative">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 ${
                      step.timestamp ? 'bg-green-500' :
                      selectedCard.currentStatus === step.stage ? 'bg-blue-500' :
                      'bg-gray-300'
                    }`}>
                      {getStatusIcon(step.stage)}
                    </div>
                    <div className="ml-6 flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="text-base font-medium text-gray-900 mb-1">
                            {step.stage.replace(/_/g, ' ')}
                          </h4>
                          <p className="text-sm text-gray-600 mb-2">{step.location}</p>
                          {step.failureReason && (
                            <p className="text-sm text-red-600 mb-2">⚠️ {step.failureReason}</p>
                          )}
                          {step.durationMinutes && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              Duration: {Math.floor(step.durationMinutes / 60)}h {step.durationMinutes % 60}m
                            </span>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-sm text-gray-600">{formatTimestamp(step.timestamp)}</p>
                          {step.timestamp && (
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDistanceToNow(new Date(step.timestamp), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
            <div className="flex flex-wrap gap-3">
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Download Report
              </button>
              <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                Share Tracking
              </button>
              {selectedCard.currentStatus.includes('FAILED') && (
                <button className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors">
                  Request Retry
                </button>
              )}
              <button className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No Results */}
      {searchResults && !Array.isArray(searchResults) && !selectedCard && (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Cards Found</h3>
          <p className="text-gray-600">
            We couldn't find any cards matching your search criteria.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Try searching with a different Card ID, mobile number, or customer name.
          </p>
        </div>
      )}

      {/* Help Section */}
      {!selectedCard && !searchResults && (
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">How to Search</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-blue-800 mb-2">Search Options:</h4>
              <ul className="space-y-1 text-blue-700">
                <li>• Card ID (e.g., CRD001234)</li>
                <li>• Mobile Number (last 4 digits)</li>
                <li>• PAN Number (masked format)</li>
                <li>• Customer Name</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-blue-800 mb-2">Tips:</h4>
              <ul className="space-y-1 text-blue-700">
                <li>• Use at least 3 characters</li>
                <li>• Search is case-insensitive</li>
                <li>• Partial matches are supported</li>
                <li>• Results update in real-time</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardSearch;