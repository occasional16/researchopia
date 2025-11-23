/**
 * EventDispatcher 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventDispatcher } from '@/lib/auth/EventDispatcher';
import type { AuthEventType, AuthEvent } from '@/lib/auth/EventDispatcher';

describe('EventDispatcher', () => {
  beforeEach(() => {
    EventDispatcher.clear();
  });

  describe('on', () => {
    it('应该成功订阅事件', () => {
      const listener = vi.fn();
      EventDispatcher.on('SIGNED_IN', listener);

      expect(EventDispatcher.getListenerCount('SIGNED_IN')).toBe(1);
    });

    it('应该返回取消订阅函数', () => {
      const listener = vi.fn();
      const unsubscribe = EventDispatcher.on('SIGNED_IN', listener);

      expect(EventDispatcher.getListenerCount('SIGNED_IN')).toBe(1);

      unsubscribe();

      expect(EventDispatcher.getListenerCount('SIGNED_IN')).toBe(0);
    });

    it('应该支持多个监听器', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      EventDispatcher.on('SIGNED_IN', listener1);
      EventDispatcher.on('SIGNED_IN', listener2);

      expect(EventDispatcher.getListenerCount('SIGNED_IN')).toBe(2);
    });
  });

  describe('off', () => {
    it('应该成功取消订阅', () => {
      const listener = vi.fn();
      EventDispatcher.on('SIGNED_IN', listener);

      expect(EventDispatcher.getListenerCount('SIGNED_IN')).toBe(1);

      EventDispatcher.off('SIGNED_IN', listener);

      expect(EventDispatcher.getListenerCount('SIGNED_IN')).toBe(0);
    });

    it('移除不存在的监听器不应抛出错误', () => {
      const listener = vi.fn();

      expect(() => {
        EventDispatcher.off('SIGNED_IN', listener);
      }).not.toThrow();
    });
  });

  describe('emit', () => {
    it('应该触发对应的监听器', () => {
      const listener = vi.fn();
      EventDispatcher.on('SIGNED_IN', listener);

      EventDispatcher.emit('SIGNED_IN', { userId: 'user123' });

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as AuthEvent;
      expect(event.type).toBe('SIGNED_IN');
      expect(event.data).toEqual({ userId: 'user123' });
      expect(event.timestamp).toBeGreaterThan(0);
    });

    it('应该触发所有订阅的监听器', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      EventDispatcher.on('SIGNED_OUT', listener1);
      EventDispatcher.on('SIGNED_OUT', listener2);

      EventDispatcher.emit('SIGNED_OUT');

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('监听器抛出错误不应影响其他监听器', () => {
      const listener1 = vi.fn(() => {
        throw new Error('Listener 1 error');
      });
      const listener2 = vi.fn();

      EventDispatcher.on('SESSION_EXPIRED', listener1);
      EventDispatcher.on('SESSION_EXPIRED', listener2);

      // 应该不抛出错误
      expect(() => {
        EventDispatcher.emit('SESSION_EXPIRED');
      }).not.toThrow();

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('没有监听器时发送事件不应抛出错误', () => {
      expect(() => {
        EventDispatcher.emit('TOKEN_UPDATED');
      }).not.toThrow();
    });

    it('应该包含正确的事件时间戳', () => {
      const listener = vi.fn();
      EventDispatcher.on('USER_UPDATED', listener);

      const before = Date.now();
      EventDispatcher.emit('USER_UPDATED');
      const after = Date.now();

      const event = listener.mock.calls[0][0] as AuthEvent;
      expect(event.timestamp).toBeGreaterThanOrEqual(before);
      expect(event.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('clear', () => {
    it('应该清空所有监听器', () => {
      EventDispatcher.on('SIGNED_IN', vi.fn());
      EventDispatcher.on('SIGNED_OUT', vi.fn());
      EventDispatcher.on('SESSION_REFRESHED', vi.fn());

      expect(EventDispatcher.getListenerCount('SIGNED_IN')).toBe(1);
      expect(EventDispatcher.getListenerCount('SIGNED_OUT')).toBe(1);
      expect(EventDispatcher.getListenerCount('SESSION_REFRESHED')).toBe(1);

      EventDispatcher.clear();

      expect(EventDispatcher.getListenerCount('SIGNED_IN')).toBe(0);
      expect(EventDispatcher.getListenerCount('SIGNED_OUT')).toBe(0);
      expect(EventDispatcher.getListenerCount('SESSION_REFRESHED')).toBe(0);
    });
  });

  describe('getListenerCount', () => {
    it('应该返回正确的监听器数量', () => {
      expect(EventDispatcher.getListenerCount('SIGNED_IN')).toBe(0);

      EventDispatcher.on('SIGNED_IN', vi.fn());
      expect(EventDispatcher.getListenerCount('SIGNED_IN')).toBe(1);

      EventDispatcher.on('SIGNED_IN', vi.fn());
      expect(EventDispatcher.getListenerCount('SIGNED_IN')).toBe(2);
    });

    it('不存在的事件类型应返回0', () => {
      expect(EventDispatcher.getListenerCount('SESSION_EXPIRED')).toBe(0);
    });
  });
});
