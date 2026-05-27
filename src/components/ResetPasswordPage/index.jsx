import React, { useEffect, useState } from 'react';
import { Button, Form, Input, Typography, message } from 'antd';
import { supabase } from '../../supabaseClient';
import './index.css';

const { Text, Title } = Typography;

function ResetPasswordPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initRecovery = async () => {
      try {
        if (typeof supabase.auth.getSessionFromUrl === 'function') {
          const { error } = await supabase.auth.getSessionFromUrl({ storeSession: true });
          if (error) {
            message.error(error.message || 'Unable to validate reset link');
          }
        }

        const { data } = await supabase.auth.getSession();
        if (isMounted) {
          setSessionReady(!!data?.session);
        }
      } catch (error) {
        if (isMounted) {
          message.error('Unable to validate reset link');
        }
      } finally {
        if (isMounted) {
          setCheckingLink(false);
        }
      }
    };

    initRecovery();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password: values.password });

      if (error) {
        message.error(error.message || 'Failed to update password');
        return;
      }

      message.success('Password updated successfully. You can now log in.');
      form.resetFields();
      window.setTimeout(() => {
        window.location.href = '/auth';
      }, 1500);
    } catch (error) {
      message.error('An error occurred while updating your password');
      console.error('Update password error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-password-page">
      <div className="reset-password-card">
        <Title level={2} className="reset-password-title">Reset Password</Title>
        {checkingLink ? (
          <Text>Validating your reset link...</Text>
        ) : sessionReady ? (
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              label="New password"
              name="password"
              rules={[{ required: true, message: 'Please enter a new password' }]}
            >
              <Input.Password placeholder="Enter a new password" />
            </Form.Item>
            <Form.Item
              label="Confirm password"
              name="confirm"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Please confirm your new password' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || value === getFieldValue('password')) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Passwords do not match'));
                  }
                })
              ]}
            >
              <Input.Password placeholder="Confirm your new password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Update password
            </Button>
          </Form>
        ) : (
          <div className="reset-password-error">
            <Text type="danger">This reset link is invalid or has expired.</Text>
            <Button type="link" onClick={() => { window.location.href = '/auth'; }}>
              Back to login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ResetPasswordPage;
