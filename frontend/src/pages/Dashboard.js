// src/pages/Dashboard.js - Main Dashboard Page
import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Package, Clock, CheckCircle, XCircle, TrendingUp, Users, MapPin, Activity } from 'lucide-react';
import { analyticsAPI } from '../services/api';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import ErrorMessage from '../components/UI/ErrorMessage';

const Dashboard = () => {
  const [timeRange, setTimeRange] = useState('24h');
  const [selectedMetric, setSelectedMetric] = useState('volume');

  // Fetch dashboard data
  const { data: dashboardData, isLoading, error, refetch } = useQuery(
    ['dashboard', timeRange],
    () => analyticsAPI.getDashboard(timeRange),
    {
      refetchInterval: 30000, // Refetch every 30 seconds
      refetchOnWindowFocus: true,
    }
  );

  const analytics = dashboardData?.data?.data;

  // Colors for charts
  const statusColors = {
    APPROVED: '#3b82f6',
    QUEUED_FOR_EMBOSSING: '#f59e0b',
    IN_EMBOSSING: '#f97316',
    EMBOSSING_COMPLETE: '#10b981',
    DISPATCHED: '#6366f1',
    IN_TRANSIT: '#8b5cf6',
    OUT_FOR_DELIVERY: '#06b6d4',
    DELIVERED: '#059669',
    DELIVERY_FAILED: '#ef4444',
    EMBOSSING_FAILED: '#dc2626'
  };

  const priorityColors = ['#3b82f6', '#f59e0b', '#ef4444'];

  // Prepare chart data
  const hourlyChartData = analytics?.hourlyProcessing?.map(item => ({
    hour: item.hour,
    processed: item.processed
  })) || [];

  const statusChartData = Object.entries(analytics?.statusBreakdown || {}).map(([status, count]) => ({
    name: status.replace(/_/g, ' '),
    value: count,
    color: statusColors[status] || '#6b7280'
  }));

  const geographicData = analytics?.geographicData?.map(region => ({
    region: region.region,
    total: region.total,
    delivered: region.delivered,
    successRate: region.successRate,
    processing: region.processing
  })) || [];

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Real-time card journey analytics</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button
            onClick={refetch}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KPICard
          title="Total Cards"
          value={analytics?.totalCards?.toLocaleString() || '0'}
          icon={Package}
          color="blue"
          change="+12%"
          changeType="increase"
        />
        <KPICard
          title="In Progress"
          value={analytics?.statusBreakdown?.IN_TRANSIT + analytics?.statusBreakdown?.IN_EMBOSSING + analytics?.statusBreakdown?.OUT_FOR_DELIVERY || 0}
          icon={Clock}
          color="yellow"
          change="+3%"
          changeType="increase"
        />
        <KPICard
          title="Delivered Today"
          value={analytics?.todayStats?.delivered?.toLocaleString() || '0'}
          icon={CheckCircle}
          color="green"
          change="+8%"
          changeType="increase"
        />
        <KPICard
          title="Failed Today"
          value={analytics?.todayStats?.failed || 0}
          icon={XCircle}
          color="red"
          change="-15%"
          changeType="decrease"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Processing Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Hourly Processing</h3>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">Live</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="hour" 
                  stroke="#6b7280"
                  fontSize={12}
                />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Bar 
                  dataKey="processed" 
                  fill="url(#blueGradient)"
                  radius={[4, 4, 0, 0]}
                />
                <defs>
                  <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#1d4ed8" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Status Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {statusChartData.slice(0, 6).map((status, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: status.color }}
                ></div>
                <span className="text-xs text-gray-600 truncate">{status.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Performance Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {analytics?.avgDeliveryTime || 0} days
            </div>
            <div className="text-sm text-gray-500 mb-2">Average Delivery Time</div>
            <div className="text-xs text-green-600">↓ 0.8 days vs last period</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">97.8%</div>
            <div className="text-sm text-gray-500 mb-2">Success Rate</div>
            <div className="text-xs text-green-600">↑ 2.1% vs last period</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {analytics?.totalCards || 0}
            </div>
            <div className="text-sm text-gray-500 mb-2">Total Processed</div>
            <div className="text-xs text-blue-600">↑ 12% vs last period</div>
          </div>
        </div>
      </div>

      {/* Geographic Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Geographic Performance</h3>
          <div className="space-y-4">
            {geographicData.slice(0, 5).map((region, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{region.region}</p>
                    <p className="text-xs text-gray-500">{region.processing} processing</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-medium ${
                    region.successRate >= 95 ? 'text-green-600' : 
                    region.successRate >= 90 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {region.successRate}%
                  </span>
                  <p className="text-xs text-gray-500">{region.total} total</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Performance */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Performance</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-600">
                {analytics?.todayStats?.processed || 0}
              </p>
              <p className="text-sm text-blue-700">Processed</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-600">
                {analytics?.todayStats?.delivered || 0}
              </p>
              <p className="text-sm text-green-700">Delivered</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <Package className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-yellow-600">
                {analytics?.todayStats?.dispatched || 0}
              </p>
              <p className="text-sm text-yellow-700">Dispatched</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-600">
                {analytics?.todayStats?.failed || 0}
              </p>
              <p className="text-sm text-red-700">Failed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Bottlenecks</h3>
        <div className="space-y-3">
          {analytics?.bottlenecks?.slice(0, 3).map((bottleneck, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-center space-x-3">
                <TrendingUp className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {bottleneck.stage?.replace(/_/g, ' ')} Stage Delay
                  </p>
                  <p className="text-xs text-gray-600">
                    {bottleneck.affectedCount} cards affected
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-yellow-600">
                  +{bottleneck.delayPercentage}%
                </span>
                <p className="text-xs text-yellow-700">vs baseline</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// KPI Card Component
const KPICard = ({ title, value, icon: Icon, color, change, changeType }) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600'
  };

  const changeColor = changeType === 'increase' ? 'text-green-600' : 'text-red-600';

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className={`text-sm mt-2 ${changeColor}`}>
              {change} vs yesterday
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;