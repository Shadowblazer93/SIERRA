import React from 'react';
import { Drawer, Tabs, Empty, Button, Typography } from 'antd';
import { StarOutlined, StarFilled, CopyOutlined } from '@ant-design/icons';
import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/stream-parser';
import { cypher } from '@codemirror/legacy-modes/mode/cypher';
import './index.css';

const { TabPane } = Tabs;
const { Text } = Typography;

function formatExecutedAt(executedAt) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(executedAt));
  } catch (error) {
    return executedAt;
  }
}

function QueryCard({ item, onToggleStar, onRestore }) {
  return (
    <div
      className="query-clipboard-card"
      style={{ background: item.backgroundColor }}
    >
      <div className="query-clipboard-card-header">
        <div>
          <Text strong>Executed</Text>
          <div className="query-clipboard-card-subtitle">{formatExecutedAt(item.executedAt)}</div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <Button
            type="text"
            size="small"
            className="query-clipboard-copy-button"
            icon={<CopyOutlined />}
            onClick={() => onRestore(item.query)}
          />
          <Button
            type="text"
            size="small"
            className="query-clipboard-star-button"
            icon={item.starred ? <StarFilled /> : <StarOutlined />}
            onClick={() => onToggleStar(item.id)}
          />
        </div>
      </div>

      <div className="query-clipboard-code-shell">
        <CodeMirror
          value={item.query}
          height="auto"
          readOnly
          extensions={[StreamLanguage.define(cypher)]}
          className="query-clipboard-code"
        />
      </div>
    </div>
  );
}

export default function QueryClipboardSidebar({ visible, onClose, history, onToggleStar, onRestore, onClearHistory }) {
  const starred = history.filter((item) => item.starred);

  const renderList = (items, emptyLabel) => {
    if (items.length === 0) {
      return <Empty description={emptyLabel} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
      <div className="query-clipboard-list">
        {items.slice().reverse().map((item) => (
          <QueryCard key={item.id} item={item} onToggleStar={onToggleStar} onRestore={onRestore} />
        ))}
      </div>
    );
  };

  return (
    <Drawer
      title="Query Clipboard"
      placement="right"
      visible={visible}
      onClose={onClose}
      width={460}
      className="query-clipboard-drawer"
      bodyStyle={{ padding: 0 }}
      mask={false}
      push={false}
    >
      <Tabs
        defaultActiveKey="history"
        className="query-clipboard-tabs"
        tabBarExtraContent={
          <Button
            type="link"
            danger
            size="small"
            className="query-clipboard-clear-button"
            disabled={history.length === 0}
            onClick={onClearHistory}
          >
            Clear history
          </Button>
        }
      >
        <TabPane tab={`History (${history.length})`} key="history">
          {renderList(history, 'No executed queries yet.')}
        </TabPane>
        <TabPane tab={`Starred Queries (${starred.length})`} key="starred">
          {renderList(starred, 'Star queries to keep them here.')}
        </TabPane>
      </Tabs>
    </Drawer>
  );
}