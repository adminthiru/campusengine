import { Dropdown, Button, Space, message } from 'antd';
import { EllipsisOutlined, DownOutlined } from '@ant-design/icons';

/**
 * DropdownMenu — reusable Ant Design dropdown button component
 *
 * Props:
 *   label        — text on the main button (optional; omit for icon-only trigger)
 *   items        — array of { key, label, icon?, danger?, disabled?, onClick? }
 *   onMenuClick  — global handler called with the clicked item key (optional)
 *   onButtonClick — handler for the main button click (optional)
 *   triggerIcon  — icon shown on the trigger button when no label (default: EllipsisOutlined)
 *   placement    — dropdown placement (default: 'bottomRight')
 *   danger       — makes the main button red (default: false)
 *   disabled     — disables both button and dropdown (default: false)
 *   loading      — shows loading spinner on trigger (default: false)
 *   type         — Ant button type: 'default' | 'primary' | 'text' | 'link' (default: 'default')
 *   size         — Ant button size: 'small' | 'middle' | 'large' (default: 'middle')
 */
export default function DropdownMenu({
  label,
  items = [],
  onMenuClick,
  onButtonClick,
  triggerIcon,
  placement = 'bottomRight',
  danger = false,
  disabled = false,
  loading = false,
  type = 'default',
  size = 'middle',
}) {
  const [messageApi, contextHolder] = message.useMessage();

  const menuProps = {
    items,
    onClick: ({ key }) => {
      const item = items.find(i => i.key === key);
      if (item?.onClick) item.onClick(key);
      if (onMenuClick) onMenuClick(key);
    },
  };

  const TriggerIcon = triggerIcon || EllipsisOutlined;

  // Split button style — main label + separate icon trigger
  if (label) {
    return (
      <>
        {contextHolder}
        <Space.Compact>
          <Button
            type={type}
            size={size}
            danger={danger}
            disabled={disabled}
            onClick={onButtonClick}
          >
            {label}
          </Button>
          <Dropdown menu={menuProps} placement={placement} disabled={disabled}>
            <Button
              type={type}
              size={size}
              danger={danger}
              disabled={disabled}
              loading={loading}
              icon={<TriggerIcon />}
            />
          </Dropdown>
        </Space.Compact>
      </>
    );
  }

  // Icon-only trigger
  return (
    <>
      {contextHolder}
      <Dropdown menu={menuProps} placement={placement} disabled={disabled}>
        <Button
          type={type}
          size={size}
          danger={danger}
          disabled={disabled}
          loading={loading}
          icon={<TriggerIcon />}
        />
      </Dropdown>
    </>
  );
}
