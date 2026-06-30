import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import ReactFlow, { ReactFlowProvider } from 'react-flow-renderer';
import { AutoComplete, Button, Form, Input, Typography, message, Modal } from 'antd';
import { Context, initialState } from '../../Store';
import Reducer from '../../Reducer';
import { supabase } from '../../supabaseClient';
import Node from '../Node';
import CustomEdge from '../CustomEdge';
import PredicateLinkEdge from '../PredicateLinkEdge';
import OrLinkEdge from '../OrLinkEdge';
import AndLinkEdge from '../AndLinkEdge';
import { buildOrGroupRoots } from '../../utils/orGroupRoots';
import showcases from '../../showcases.json';
import './index.css';

const { Text } = Typography;

const normalizeQuery = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const getFaviconUrl = (webPages) => {
  const url = Array.isArray(webPages) ? webPages[0] : '';
  if (!url) return '';
  return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=32`;
};

const buildInstitutionLabel = (item) => {
  const name = item?.name || '';
  const faviconUrl = getFaviconUrl(item?.web_pages);
  return (
    <span className="auth-institution-option">
      {faviconUrl && (
        <img
          className="auth-institution-flag"
          src={faviconUrl}
          alt=""
          loading="lazy"
          aria-hidden
        />
      )}
      <span>{name}</span>
    </span>
  );
};

const buildInstitutionOptions = (items, input) => {
  const query = normalizeQuery(input);
  if (!query) return [];

  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const name = item?.name || '';
      const country = item?.country || '';
      const fullValue = country ? `${name} (${country})` : name;
      const normalizedName = normalizeQuery(name);
      const normalizedFull = normalizeQuery(fullValue);
      if (!normalizedName.includes(query) && !normalizedFull.includes(query)) return null;
      return {
        value: name,
        label: buildInstitutionLabel(item),
        fullValue
      };
    })
    .filter(Boolean)
    .slice(0, 8);
};

const getPasswordStrength = (value) => {
  const password = String(value || '');
  if (!password) return { score: 0, label: 'Enter a password' };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score, label: labels[Math.min(score, labels.length - 1)] };
};

const pickShowcase = (items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const valid = items.filter(Boolean);
  if (valid.length === 0) return null;
  return valid[Math.floor(Math.random() * valid.length)];
};

const buildShowcaseState = (showcase) => {
  const graph = showcase?.graph || {};
  const dnfHoverCount = Number.isFinite(graph.dnfHoverCount) ? graph.dnfHoverCount : 0;
  const dnfHovering = typeof graph.dnfHovering === 'boolean' ? graph.dnfHovering : dnfHoverCount > 0;

  return {
    ...initialState,
    nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
    edges: Array.isArray(graph.edges) ? graph.edges : [],
    predicateLinks: Array.isArray(graph.predicateLinks) ? graph.predicateLinks : [],
    orLinks: Array.isArray(graph.orLinks) ? graph.orLinks : [],
    andLinks: Array.isArray(graph.andLinks) ? graph.andLinks : [],
    predDisplayStatus: graph.predDisplayStatus || initialState.predDisplayStatus,
    orRepresentation: graph.orRepresentation || initialState.orRepresentation,
    reducedEdgeCrossing: graph.reducedEdgeCrossing ?? initialState.reducedEdgeCrossing,
    dnfMode: !!graph.dnfMode,
    dnfLinksVisible: !!graph.dnfLinksVisible,
    dnfAndGroupingEnabled: !!graph.dnfAndGroupingEnabled,
    dnfHoverCount,
    dnfHovering
  };
};

function AuthPage() {
  const [registerForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('login');
  const [passwordStrength, setPasswordStrength] = useState(getPasswordStrength(''));
  const [confirmPasswordStatus, setConfirmPasswordStatus] = useState('idle');
  const [institutionValue, setInstitutionValue] = useState('');
  const [institutionOptions, setInstitutionOptions] = useState([]);
  const institutionSearchRef = useRef({ timeoutId: 0 });
  const [institutionList, setInstitutionList] = useState([]);
  const institutionLoadedRef = useRef(false);
  const [showcase] = useState(() => pickShowcase(showcases));
  const reactFlowRef = useRef(null);
  const showcaseCanvasRef = useRef(null);
  const [showcaseState, showcaseDispatch] = useReducer(
    Reducer,
    showcase,
    buildShowcaseState
  );
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [resetPasswordVisible, setResetPasswordVisible] = useState(false);
  const [resetPasswordEmail, setResetPasswordEmail] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordForm] = Form.useForm();
  const [isExiting, setIsExiting] = useState(false);

  const fitShowcase = () => {
    const instance = reactFlowRef.current;
    if (!instance || typeof instance.fitView !== 'function') return;
    instance.fitView({ padding: 0.18, includeHiddenNodes: false, duration: 0 });
  };

  const handleLogin = async (values) => {
    try {
      setLoginLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password
      });

      if (error) {
        message.error(error.message || 'Failed to sign in');
        return;
      }

      message.success('Successfully signed in!');
      setIsExiting(true);
      window.setTimeout(() => {
        window.location.hash = '#/';
      }, 600);
    } catch (error) {
      message.error('An error occurred during sign in');
      console.error('Login error:', error);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (values) => {
    try {
      setRegisterLoading(true);

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.name,
            institution: values.institution
          }
        }
      });

      if (authError) {
        message.error(authError.message || 'Failed to create account');
        return;
      }

      if (!authData.user) {
        message.error('Registration failed. Please try again.');
        return;
      }

      message.success('Account created successfully!.');
      registerForm.resetFields();
      setInstitutionValue('');

      // Switch to login tab after a brief delay so the user sees the success message
      setTimeout(() => {
        setActiveTab('login');
        // Show info message in login tab
        setTimeout(() => {
          message.info('Please log in with your new account.');
        }, 300);
      }, 1500);
    } catch (error) {
      message.error('An error occurred during registration');
      console.error('Registration error:', error);
    } finally {
      setRegisterLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    try {
      setResetPasswordLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(resetPasswordEmail, {
        redirectTo: `${window.location.origin}/#/auth/reset-password`,
      });

      if (error) {
        message.error(error.message || 'Failed to send reset email');
        return;
      }

      message.success('Password reset email sent! Check your inbox.');
      resetPasswordForm.resetFields();
      setResetPasswordEmail('');
      setResetPasswordVisible(false);
    } catch (error) {
      message.error('An error occurred while resetting your password');
      console.error('Password reset error:', error);
    } finally {
      setResetPasswordLoading(false);
    }
  };

  useEffect(() => {
    const canvasElement = showcaseCanvasRef.current;
    if (!canvasElement || typeof ResizeObserver === 'undefined') return undefined;

    let frameId = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        fitShowcase();
      });
    });

    observer.observe(canvasElement);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'register' || institutionLoadedRef.current) return;
    const controller = new AbortController();

    const loadInstitutions = async () => {
      try {
        const response = await fetch(
          'https://raw.githubusercontent.com/Hipo/university-domains-list/refs/heads/master/world_universities_and_domains.json',
          { signal: controller.signal }
        );
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted) {
          setInstitutionList(Array.isArray(data) ? data : []);
          institutionLoadedRef.current = true;
        }
      } catch (error) {
        // Ignore fetch failures; autocomplete will show no suggestions.
      }
    };

    loadInstitutions();

    return () => {
      controller.abort();
    };
  }, [activeTab]);

  const orGroupRoots = useMemo(
    () => buildOrGroupRoots(showcaseState.nodes, showcaseState.orLinks),
    [showcaseState.nodes, showcaseState.orLinks]
  );

  const orGroupColors = useMemo(
    () => (showcase?.orGroupColors && typeof showcase.orGroupColors === 'object' ? showcase.orGroupColors : {}),
    [showcase]
  );

  const getOrGroupColor = (groupId) => orGroupColors[groupId] || '#ff8c00';

  const predicateLinkElements = useMemo(
    () => (showcaseState.predicateLinks || []).map((link, idx) => ({
      id: `predicate-link-${idx}`,
      source: link.from.nodeId,
      target: link.to.nodeId,
      sourceHandle: link.from.attr,
      targetHandle: link.to.attr,
      type: 'predicateLink',
      data: {
        fromAttr: link.from.attr,
        toAttr: link.to.attr,
        operator: link.operator,
        joinType: link.joinType
      }
    })),
    [showcaseState.predicateLinks]
  );

  const orLinkElements = useMemo(
    () => (showcaseState.orLinks || []).map((link, idx) => {
      const fromKey = `${link.from.nodeId}_${link.from.attr}`;
      const toKey = `${link.to.nodeId}_${link.to.attr}`;
      const sourceGroupId = orGroupRoots[fromKey];
      const targetGroupId = orGroupRoots[toKey];
      const isSameNode = String(link.from.nodeId) === String(link.to.nodeId);
      const isSameGroup = !!sourceGroupId && !!targetGroupId && sourceGroupId === targetGroupId;
      const orRepresentation = showcaseState.orRepresentation || 'sunflower';

      if (orRepresentation === 'sunflower' && isSameNode && isSameGroup) {
        return null;
      }

      const groupId = sourceGroupId || targetGroupId || fromKey;
      const groupColor = getOrGroupColor(groupId);

      return {
        id: `or-link-${idx}`,
        source: link.from.nodeId,
        target: link.to.nodeId,
        sourceHandle: link.from.attr,
        targetHandle: link.to.attr,
        type: 'orLink',
        data: {
          fromAttr: link.from.attr,
          toAttr: link.to.attr,
          orGroupId: groupId,
          orGroupColor: groupColor,
          sourceGroupId,
          targetGroupId,
          isSameGroup,
          orRepresentation,
          isGroupHovering: false,
          hideEdgeLabel: isSameNode && isSameGroup,
          opacity: 1
        }
      };
    }).filter(Boolean),
    [showcaseState.orLinks, showcaseState.orRepresentation, orGroupRoots, orGroupColors]
  );

  const andLinkElements = useMemo(
    () => (showcaseState.andLinks || []).map((link, idx) => ({
      id: `and-link-${idx}`,
      source: link.from.nodeId,
      target: link.to.nodeId,
      sourceHandle: link.from.attr,
      targetHandle: link.to.attr,
      type: 'andLink',
      data: {
        groupId: link.groupId,
        color: link.color,
        opacity: 1
      }
    })),
    [showcaseState.andLinks]
  );

  const edgeElements = useMemo(
    () => (showcaseState.edges || []).map((edge) => {
      const sourceNode = showcaseState.nodes.find((n) => n.id === edge.source);
      const targetNode = showcaseState.nodes.find((n) => n.id === edge.target);
      return {
        ...edge,
        data: {
          ...edge.data,
          isBold: edge.isBold,
          sourcePredicates: sourceNode?.data?.predicates || {},
          targetPredicates: targetNode?.data?.predicates || {}
        }
      };
    }),
    [showcaseState.edges, showcaseState.nodes]
  );

  const nodeElements = useMemo(
    () => (showcaseState.nodes || []).map((node) => ({
      ...node,
      data: {
        ...node.data,
        color: node.color,
        radius: node.radius,
        isBold: node.isBold,
        orGroupRoots
      }
    })),
    [showcaseState.nodes, orGroupRoots]
  );

  const elements = useMemo(
    () => nodeElements.concat(andLinkElements, edgeElements, predicateLinkElements, orLinkElements),
    [nodeElements, andLinkElements, edgeElements, predicateLinkElements, orLinkElements]
  );

  return (
    <div className={`auth-page${isExiting ? ' auth-page--exit' : ''}`}>
      <div className="auth-graph-pane">
        <div className="auth-graph-title">SIERRA</div>
        <div className="auth-showcase-canvas" ref={showcaseCanvasRef}>
          <Context.Provider value={[showcaseState, showcaseDispatch]}>
            <ReactFlowProvider>
              <ReactFlow
                ref={reactFlowRef}
                elements={elements}
                nodeTypes={{ special: Node }}
                edgeTypes={{
                  custom: CustomEdge,
                  predicateLink: PredicateLinkEdge,
                  orLink: OrLinkEdge,
                  andLink: AndLinkEdge
                }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                zoomOnScroll={false}
                zoomOnDoubleClick={false}
                zoomOnPinch={false}
                panOnScroll={false}
                panOnDrag={false}
                style={{ pointerEvents: 'none' }}
                onLoad={(instance) => {
                  reactFlowRef.current = instance;
                  const viewport = showcase?.viewport;
                  if (viewport && typeof instance.setTransform === 'function') {
                    instance.setTransform(viewport);
                  }
                  window.requestAnimationFrame(() => {
                    fitShowcase();
                  });
                }}
              >
              </ReactFlow>
            </ReactFlowProvider>
          </Context.Provider>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-panel-inner">
          <div className="auth-tabs">
            <Button
              className="auth-tab-button"
              onClick={() => setActiveTab('login')}
              type={activeTab === 'login' ? 'primary' : 'default'}
              style={{ flex: 1 }}
            >
              Login
            </Button>
            <Button
              className="auth-tab-button"
              onClick={() => setActiveTab('register')}
              type={activeTab === 'register' ? 'primary' : 'default'}
              style={{ flex: 1 }}
            >
              Register
            </Button>
          </div>

          {activeTab === 'login' ? (
            <Form layout="vertical" className="auth-form" form={registerForm} onFinish={handleLogin}>
              <Form.Item
                label="Email"
                name="email"
                rules={[
                  { required: true, message: 'Please enter your email' },
                  { type: 'email', message: 'Please enter a valid email address' }
                ]}
              >
                <Input placeholder="name@domain.com" />
              </Form.Item>
              <Form.Item
                label="Password"
                name="password"
                rules={[{ required: true, message: 'Please enter your password' }]}
              >
                <Input.Password placeholder="Enter your password" />
              </Form.Item>
              <Button
                className="auth-action-button"
                htmlType="submit"
                loading={loginLoading}
              >
                Sign in
              </Button>
              <div className="auth-helper-row">
                <Text>Need help?</Text>
                <Button
                  type="link"
                  className="auth-link-button"
                  onClick={() => setResetPasswordVisible(true)}
                >
                  Reset password
                </Button>
              </div>
            </Form>
          ) : (
            <Form layout="vertical" className="auth-form" form={registerForm} onFinish={handleRegister}>
              <Form.Item
                label="Full name"
                name="name"
                rules={[{ required: true, message: 'Please enter your full name' }]}
              >
                <Input placeholder="Ada Lovelace" />
              </Form.Item>
              <Form.Item
                label="Email"
                name="email"
                rules={[
                  { required: true, message: 'Please enter your email address' },
                  { type: 'email', message: 'Please enter a valid email address' }
                ]}
              >
                <Input placeholder="you@domain.com" />
              </Form.Item>
              <Form.Item
                label="Institution"
                name="institution"
                rules={[{ required: true, message: 'Please enter your institution' }]}
              >
                <AutoComplete
                  options={institutionOptions}
                  value={institutionValue}
                  onChange={(value) => {
                    setInstitutionValue(value);
                    registerForm.setFieldsValue({
                      institution: value,
                      institutionCanonical: value
                    });
                  }}
                  onSearch={(value) => {
                    setInstitutionValue(value);
                    registerForm.setFieldsValue({
                      institution: value,
                      institutionCanonical: value
                    });

                    if (institutionSearchRef.current.timeoutId) {
                      window.clearTimeout(institutionSearchRef.current.timeoutId);
                    }

                    institutionSearchRef.current.timeoutId = window.setTimeout(async () => {
                      setInstitutionOptions(buildInstitutionOptions(institutionList, value));
                    }, 250);
                  }}
                  onSelect={(value, option) => {
                    setInstitutionValue(value);
                    registerForm.setFieldsValue({
                      institution: value,
                      institutionCanonical: option?.fullValue || value
                    });
                  }}
                  onBlur={() => {
                    const normalized = normalizeQuery(institutionValue);
                    const match = institutionOptions.find(
                      (option) => normalizeQuery(option.value) === normalized
                      || normalizeQuery(option.fullValue) === normalized
                    );
                    if (match) {
                      setInstitutionValue(match.value);
                      registerForm.setFieldsValue({
                        institution: match.value,
                        institutionCanonical: match.fullValue || match.value
                      });
                    } else {
                      registerForm.setFieldsValue({
                        institution: institutionValue,
                        institutionCanonical: institutionValue
                      });
                    }
                  }}
                >
                  <Input
                    placeholder="Your institution"
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      if (!institutionOptions.length) return;
                      event.preventDefault();
                      const first = institutionOptions[0];
                      setInstitutionValue(first.value);
                      registerForm.setFieldsValue({
                        institution: first.value,
                        institutionCanonical: first.fullValue || first.value
                      });
                    }}
                  />
                </AutoComplete>
              </Form.Item>
              <Form.Item
                name="institutionCanonical"
                hidden
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Password"
                name="password"
                rules={[{ required: true, message: 'Please create a password' }]}
              >
                <Input.Password
                  placeholder="Create a password"
                  onChange={(event) => {
                    const nextPassword = event.target.value;
                    setPasswordStrength(getPasswordStrength(nextPassword));
                    const confirmValue = registerForm.getFieldValue('confirm');
                    if (confirmValue) {
                      setConfirmPasswordStatus(confirmValue === nextPassword ? 'match' : 'mismatch');
                    } else {
                      setConfirmPasswordStatus('idle');
                    }
                  }}
                />
              </Form.Item>
              <div className="auth-password-strength" aria-live="polite">
                <div className="auth-password-meter" aria-hidden>
                  <span
                    className={`auth-password-meter-fill strength-${passwordStrength.score}`}
                    style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                  />
                </div>
                <span className="auth-password-label">{passwordStrength.label}</span>
              </div>
              <Form.Item
                label="Confirm password"
                name="confirm"
                dependencies={["password"]}
                rules={[
                  { required: true, message: 'Please confirm your password' },
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
                <Input.Password
                  placeholder="Confirm your password"
                  onChange={(event) => {
                    const confirmValue = event.target.value;
                    const passwordValue = registerForm.getFieldValue('password');
                    if (!confirmValue) {
                      setConfirmPasswordStatus('idle');
                      return;
                    }
                    setConfirmPasswordStatus(confirmValue === passwordValue ? 'match' : 'mismatch');
                  }}
                />
              </Form.Item>
              {confirmPasswordStatus === 'match' && (
                <div
                  className={
                    confirmPasswordStatus === 'match'
                      ? 'auth-password-match auth-password-match--success'
                      : 'auth-password-match auth-password-match--error'
                  }
                  role="status"
                  aria-live="polite"
                >
                  {confirmPasswordStatus === 'match'
                    ? 'Passwords match'
                    : 'Passwords do not match'}
                </div>
              )}
              <Button className="auth-action-button" htmlType="submit" loading={registerLoading}>
                Create account
              </Button>
              <div className="auth-helper-row">
                <Text>Already have access?</Text>
                <Button type="link" className="auth-link-button" onClick={() => setActiveTab('login')}>
                  Sign in
                </Button>
              </div>
            </Form>
          )}
        </div>
      </div>

      <Modal
        title="Reset Password"
        visible={resetPasswordVisible}
        onCancel={() => {
          setResetPasswordVisible(false);
          resetPasswordForm.resetFields();
          setResetPasswordEmail('');
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setResetPasswordVisible(false);
              resetPasswordForm.resetFields();
              setResetPasswordEmail('');
            }}
          >
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={resetPasswordLoading}
            onClick={handlePasswordReset}
            disabled={!resetPasswordEmail}
          >
            Send Reset Email
          </Button>,
        ]}
      >
        <Form form={resetPasswordForm} layout="vertical">
          <Form.Item
            label="Email address"
            name="resetEmail"
            rules={[
              { required: true, message: 'Please enter your email address' },
              { type: 'email', message: 'Please enter a valid email address' }
            ]}
          >
            <Input
              placeholder="Enter your email"
              type="email"
              value={resetPasswordEmail}
              onChange={(event) => setResetPasswordEmail(event.target.value)}
            />
          </Form.Item>
          <Text type="secondary">
            We'll send you an email with a link to reset your password.
          </Text>
        </Form>
      </Modal>
    </div>
  );
}

export default AuthPage;
