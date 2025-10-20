/**
 * Smart Notifications Operation - App Entrypoint
 * Interface configuration for Directus Flows UI
 */

export default {
  id: 'smart-notification-send',
  name: 'Send Smart Notification',
  icon: 'mail',
  description: 'Send a notification using a notification rule',
  overview: ({ rule_id, collection, item_id }) => [
    {
      label: 'Rule ID',
      text: rule_id || 'Not configured'
    },
    {
      label: 'Collection',
      text: collection || 'Current collection'
    },
    {
      label: 'Item ID',
      text: item_id || 'Current item'
    }
  ],
  options: [
    {
      field: 'rule_id',
      name: 'Notification Rule',
      type: 'integer',
      meta: {
        width: 'full',
        interface: 'select-dropdown-m2o',
        options: {
          template: '{{name}}',
          filter: {
            status: {
              _eq: 'published'
            }
          }
        },
        note: 'Select the notification rule to execute'
      },
      schema: {
        collection: 'quartz_notification_rules',
        field: 'id'
      }
    },
    {
      field: 'collection',
      name: 'Collection',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'input',
        note: 'Leave empty to use the trigger collection',
        options: {
          placeholder: '$trigger.collection'
        }
      }
    },
    {
      field: 'item_id',
      name: 'Item ID',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'input',
        note: 'Leave empty to use the trigger item',
        options: {
          placeholder: '$trigger.key'
        }
      }
    },
    {
      field: 'override_recipient',
      name: 'Override Recipient (Optional)',
      type: 'string',
      meta: {
        width: 'full',
        interface: 'input',
        note: 'Override the rule recipients with this email',
        options: {
          placeholder: 'admin@example.com'
        }
      }
    },
    {
      field: 'use_queue',
      name: 'Use Queue',
      type: 'boolean',
      meta: {
        width: 'half',
        interface: 'boolean',
        note: 'Queue the notification for async processing (recommended)',
        options: {
          label: 'Queue notification instead of sending immediately'
        }
      },
      schema: {
        default_value: true
      }
    },
    {
      field: 'priority',
      name: 'Priority',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'select-dropdown',
        options: {
          choices: [
            { text: 'High', value: 'high' },
            { text: 'Normal', value: 'normal' },
            { text: 'Low', value: 'low' }
          ]
        }
      },
      schema: {
        default_value: 'normal'
      }
    }
  ]
};
