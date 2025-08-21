// src/pages/CardSearch.js - Enhanced Card Search and Tracking
import React, { useState } from 'react';
import { useMutation } from 'react-query';
import { 
  Search, CreditCard, Phone, MapPin, Calendar, Activity, AlertCircle, 
  CheckCircle, Clock, XCircle, User, Hash, Package, Truck, 
  Factory, Building, Info, ChevronDown, ChevronUp, Eye, EyeOff 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cardAPI } from '../services/api';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import toast from 'react-hot-toast';

const CardSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState(new Set());
  const [showEventData, setShowEventData] = useState(new Set());

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
        toast.error('Search failed. Please try again.');
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

  const toggleEventExpansion = (index) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedEvents(newExpanded);
  };

  const toggleEventData = (index) => {
    const newShowData = new Set(showEventData);
    if (newShowData.has(index)) {
      newShowData.delete(index);
    } else {
      newShowData.add(index);
    }
    setShowEventData(newShowData);
  };

  const getStatusIcon = (status) => {
    const iconMap = {
      'DELIVERED': <CheckCircle className="w-5 h-5 text-green-600" />,
      'IN_TRANSIT': <Truck className="w-5 h-5 text-blue-600 animate-pulse" />,
      'OUT_FOR_DELIVERY': <Activity className="w-5 h-5 text-indigo-600 animate-pulse" />,
      'DISPATCHED': <Package className="w-5 h-5 text-purple-600" />,
      'EMBOSSING_COMPLETE': <Factory className="w-5 h-5 text-green-600" />,
      'IN_EMBOSSING': <Factory className="w-5 h-5 text-orange-600 animate-pulse" />,
      'QUEUED_FOR_EMBOSSING': <Clock className="w-5 h-5 text-yellow-600" />,
      'APPROVED': <CheckCircle className="w-5 h-5 text-blue-600" />,
      'DELIVERY_FAILED': <XCircle className="w-5 h-5 text-red-600" />,
      'EMBOSSING_FAILED': <XCircle className="w-5 h-5 text-red-600" />,
      'RETURNED': <AlertCircle className="w-5 h-5 text-orange-600" />,
      'DESTROYED': <XCircle className="w-5 h-5 text-gray-600" />
    };
    return iconMap[status] || <Clock className="w-5 h-5 text-gray-600" />;
  };

  const getStatusColor = (status) => {
    const colors = {
      // ✅ Success states
      'APPROVED': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'EMBOSSING_COMPLETE': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'DELIVERED': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  
      // ⏳ Processing / Info
      'QUEUED_FOR_EMBOSSING': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'IN_EMBOSSING': 'bg-orange-100 text-orange-800 border-orange-200',
      'DISPATCHED': 'bg-blue-100 text-blue-800 border-blue-200',
      'IN_TRANSIT': 'bg-sky-100 text-sky-800 border-sky-200',
      'OUT_FOR_DELIVERY': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  
      // ❌ Failure / Exception
      'EMBOSSING_FAILED': 'bg-red-100 text-red-800 border-red-200',
      'DELIVERY_FAILED': 'bg-red-100 text-red-800 border-red-200',
      'RETURNED': 'bg-orange-100 text-orange-800 border-orange-200',
      'DESTROYED': 'bg-gray-100 text-gray-800 border-gray-200',
    };
  
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };
  

  const getSourceIcon = (source) => {
    const sourceMap = {
      'bank': <Building className="w-4 h-4" />,
      'BankSystem': <Building className="w-4 h-4" />,
      'card_management_service': <CreditCard className="w-4 h-4" />,
      'manufacturer': <Factory className="w-4 h-4" />,
      'logistics': <Truck className="w-4 h-4" />,
      'embossing_service': <Factory className="w-4 h-4" />,
      'delivery_service': <Package className="w-4 h-4" />
    };
    return sourceMap[source] || <Info className="w-4 h-4" />;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Pending';
    return new Date(timestamp).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h ${mins}m`;
    }
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const renderEventData = (eventData) => {
    if (!eventData || typeof eventData !== 'object') return null;
    
    return (
      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
        <h5 className="text-xs font-medium text-gray-700 mb-2">Event Data:</h5>
        <div className="space-y-1">
          {Object.entries(eventData).map(([key, value]) => (
            <div key={key} className="flex justify-between text-xs">
              <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
              <span className="text-gray-800 font-mono">
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Track Your Card</h1>
        <p className="text-gray-600">Search by Card ID, Mobile Number, or Customer Name</p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <form onSubmit={handleSearch} className="flex space-x-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Enter Card ID, Mobile Number, or Customer Name"
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
            {['CRD001234', 'John Doe', '9876543210'].map((example) => (
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
                  {selectedCard.applicationId && (
                    <p className="text-sm text-gray-500">Application ID: {selectedCard.applicationId}</p>
                  )}
                  {selectedCard.retryCount > 0 && (
                    <p className="text-sm text-orange-600">Retry Count: {selectedCard.retryCount}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedCard.currentStatus)}`}>
                  {selectedCard.currentStatus.replace(/_/g, ' ')}
                </span>
                {selectedCard.priority !== 'STANDARD' && (
                  <div className="mt-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                      selectedCard.priority === 'EXPRESS' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                      selectedCard.priority === 'URGENT' ? 'bg-red-100 text-red-800 border-red-200' :
                      'bg-gray-100 text-gray-800 border-gray-200'
                    }`}>
                      {selectedCard.priority === 'EXPRESS' ? '⚡' : selectedCard.priority === 'URGENT' ? '🚨' : '📋'} {selectedCard.priority}
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

            {/* Metadata Section */}
            {selectedCard.metadata && Object.keys(selectedCard.metadata).length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Additional Information</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(selectedCard.metadata).map(([key, value]) => (
                    <div key={key} className="flex">
                      <span className="text-gray-600 capitalize">
                        {key.replace(/([A-Z])/g, ' $1')}:
                      </span>
                      <span className="text-gray-800 font-medium ml-1">
                        {String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Enhanced Journey Timeline */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Detailed Journey Timeline</h3>
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              <div className="space-y-6">
                {selectedCard.journey?.map((step, index) => (
                  <div key={step._id || index} className="flex items-start relative">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 ${
                      step.timestamp ? 'bg-green-500' :
                      selectedCard.currentStatus === step.stage ? 'bg-blue-500' :
                      'bg-gray-300'
                    }`}>
                      {getStatusIcon(step.stage)}
                    </div>
                    <div className="ml-6 flex-1 min-w-0">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className="text-base font-medium text-gray-900">
                                {step.stage.replace(/_/g, ' ')}
                              </h4>
                              <button
                                onClick={() => toggleEventExpansion(index)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                {expandedEvents.has(index) ? 
                                  <ChevronUp className="w-4 h-4" /> : 
                                  <ChevronDown className="w-4 h-4" />
                                }
                              </button>
                            </div>
                            
                            <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                              <div className="flex items-center space-x-1">
                                {getSourceIcon(step.source)}
                                <span>{step.source}</span>
                              </div>
                              {step.location && (
                                <div className="flex items-center space-x-1">
                                  <MapPin className="w-4 h-4" />
                                  <span>{step.location}</span>
                                </div>
                              )}
                            </div>

                            {step.failureReason && (
                              <div className="bg-red-50 border border-red-200 rounded p-2 mb-2">
                                <p className="text-sm text-red-600">⚠️ {step.failureReason}</p>
                              </div>
                            )}
                          </div>
                          
                          <div className="text-right ml-4">
                            <p className="text-sm font-medium text-gray-900">
                              {formatTimestamp(step.timestamp)}
                            </p>
                            {step.timestamp && (
                              <p className="text-xs text-gray-500 mt-1">
                                {formatDistanceToNow(new Date(step.timestamp), { addSuffix: true })}
                              </p>
                            )}
                            {step.durationMinutes && (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 mt-1">
                                ⏱️ {formatDuration(step.durationMinutes)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedEvents.has(index) && (
                          <div className="border-t border-gray-200 pt-3 mt-3">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              {step.operatorId && (
                                <div className="flex items-center space-x-2">
                                  <User className="w-4 h-4 text-gray-400" />
                                  <div>
                                    <p className="text-gray-500">Operator</p>
                                    <p className="font-medium">{step.operatorId}</p>
                                  </div>
                                </div>
                              )}
                              {step.batchId && (
                                <div className="flex items-center space-x-2">
                                  <Hash className="w-4 h-4 text-gray-400" />
                                  <div>
                                    <p className="text-gray-500">Batch ID</p>
                                    <p className="font-medium">{step.batchId}</p>
                                  </div>
                                </div>
                              )}
                              {step.trackingId && (
                                <div className="flex items-center space-x-2">
                                  <Package className="w-4 h-4 text-gray-400" />
                                  <div>
                                    <p className="text-gray-500">Tracking ID</p>
                                    <p className="font-medium">{step.trackingId}</p>
                                  </div>
                                </div>
                              )}
                              {step.previousStage && (
                                <div className="flex items-center space-x-2">
                                  <Activity className="w-4 h-4 text-gray-400" />
                                  <div>
                                    <p className="text-gray-500">Previous Stage</p>
                                    <p className="font-medium">{step.previousStage.replace(/_/g, ' ')}</p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Event Data Toggle */}
                            {step.eventData && Object.keys(step.eventData).length > 0 && (
                              <div className="mt-3">
                                <button
                                  onClick={() => toggleEventData(index)}
                                  className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                                >
                                  {showEventData.has(index) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  <span>{showEventData.has(index) ? 'Hide' : 'Show'} Technical Details</span>
                                </button>
                                {showEventData.has(index) && renderEventData(step.eventData)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
                <li>• Click events for more details</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardSearch;