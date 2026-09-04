'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  Bell, CheckCircle2, AlertTriangle, Info, XCircle, CheckSquare,
  Square, Trash2, Filter, Search, ChevronLeft, ChevronRight
} from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const limit = 20;
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    fetchNotifications();
  }, [filter, page]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/notifications?page=${page}&limit=${limit}&unreadOnly=${filter === 'unread'}`);
      setNotifications(response.data.data);
      setTotal(response.data.total);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} notifications?`)) return;
    try {
      await Promise.all(Array.from(selectedIds).map(id => api.delete(`/notifications/${id}`)));
      setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to delete notifications:', error);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map(n => n.id)));
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'assessment_complete': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'assessment_failed': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'assessment_assigned': return <Info className="w-5 h-5 text-blue-500" />;
      case 'document_request': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'subscription_expiring': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      default: return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'assessment_complete': return 'bg-green-50 border-green-200';
      case 'assessment_failed': return 'bg-red-50 border-red-200';
      case 'assessment_assigned': return 'bg-blue-50 border-blue-200';
      case 'document_request': return 'bg-yellow-50 border-yellow-200';
      case 'subscription_expiring': return 'bg-orange-50 border-orange-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button onClick={() => router.push('/')} className="text-gray-600 hover:text-gray-900 mr-4">
                ← Back
              </button>
              <Bell className="w-8 h-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
            </div>
            <div className="flex items-center space-x-3">
              {selectedIds.size > 0 && (
                <>
                  <span className="text-sm text-gray-600">{selectedIds.size} selected</span>
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </button>
                </>
              )}
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg"
              >
                <CheckSquare className="w-4 h-4 mr-1" />
                Mark All Read
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search notifications..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  filter === 'all'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  filter === 'unread'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Unread
              </button>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="divide-y divide-gray-200">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-gray-50 ${!notification.isRead ? 'bg-blue-50' : ''} ${getNotificationColor(notification.type)}`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 mr-4">
                    <button
                      onClick={() => {
                        const newSelected = new Set(selectedIds);
                        if (newSelected.has(notification.id)) {
                          newSelected.delete(notification.id);
                        } else {
                          newSelected.add(notification.id);
                        }
                        setSelectedIds(newSelected);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {selectedIds.has(notification.id) ?
                        <CheckSquare className="w-5 h-5 text-primary-600" /> :
                        <Square className="w-5 h-5" />
                      }
                    </button>
                  </div>
                  <div className="flex-shrink-0 mr-4">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-900">{notification.title}</h3>
                      <span className="text-xs text-gray-500">
                        {new Date(notification.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                    {!notification.isRead && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    <button
                      onClick={() => handleDelete(notification.id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {notifications.length === 0 && (
              <div className="px-6 py-12 text-center">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No notifications yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between mt-6">
            <div className="text-sm text-gray-600">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} notifications
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
