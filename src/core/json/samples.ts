/** Realistic sample documents for "Load sample" actions. */
export const SAMPLE_ORDER_JSON = `{
  "order_id": 1001,
  "customer_name": "Ahmed",
  "email": "ahmed@example.com",
  "created_at": "2026-11-02T09:15:00Z",
  "total_amount": 2500.5,
  "currency": "USD",
  "is_paid": true,
  "coupon": null,
  "shipping_address": {
    "street": "12 Palm Avenue",
    "city": "Dubai",
    "postal_code": "00000",
    "country": "AE"
  },
  "items": [
    { "sku": "KB-001", "name": "Mechanical keyboard", "quantity": 1, "unit_price": 1200, "tags": ["peripherals", "rgb"] },
    { "sku": "MS-042", "name": "Wireless mouse", "quantity": 2, "unit_price": 650.25, "tags": ["peripherals"] }
  ],
  "metadata": {
    "source": "web",
    "experiments": { "checkout_v2": true }
  }
}`;

export const SAMPLE_ORDER_JSON_V2 = `{
  "order_id": 1001,
  "customer_name": "Ahmed Khan",
  "email": "ahmed@example.com",
  "created_at": "2026-11-02T09:15:00Z",
  "total_amount": "2500.50",
  "currency": "USD",
  "is_paid": true,
  "shipping_address": {
    "street": "12 Palm Avenue",
    "city": "Abu Dhabi",
    "country": "AE"
  },
  "items": [
    { "sku": "KB-001", "name": "Mechanical keyboard", "quantity": 1, "unit_price": 1200, "tags": ["peripherals", "rgb"] },
    { "sku": "MS-042", "name": "Wireless mouse", "quantity": 3, "unit_price": 650.25, "tags": ["peripherals"] },
    { "sku": "PD-007", "name": "Desk pad", "quantity": 1, "unit_price": 99, "tags": [] }
  ],
  "metadata": {
    "source": "mobile",
    "experiments": { "checkout_v2": true },
    "app_version": "4.2.0"
  }
}`;

export const SAMPLE_USERS_CSV = `id,name,email,address.city,address.country,active,score
1,Alice Johnson,alice@example.com,London,UK,true,91.5
2,Bilal Ahmed,bilal@example.com,Karachi,PK,true,78
3,"Chen, Wei",chen@example.com,Shanghai,CN,false,
4,Diana Prince,diana@example.com,New York,US,true,88.25`;

export const SAMPLE_FLAT_JSON = `{
  "user.id": 42,
  "user.name": "Ada",
  "user.roles.0": "admin",
  "user.roles.1": "editor",
  "settings.theme": "dark",
  "settings.notifications.email": true
}`;

export const SAMPLE_SCHEMA_JSON = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["order_id", "customer_name", "total_amount", "items"],
  "properties": {
    "order_id": { "type": "integer", "minimum": 1 },
    "customer_name": { "type": "string", "minLength": 1 },
    "email": { "type": "string", "format": "email" },
    "total_amount": { "type": "number", "minimum": 0 },
    "items": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["sku", "quantity"],
        "properties": {
          "sku": { "type": "string", "pattern": "^[A-Z]{2}-\\\\d{3}$" },
          "quantity": { "type": "integer", "minimum": 1 }
        }
      }
    }
  }
}`;
