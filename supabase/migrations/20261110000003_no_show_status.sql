-- "Not picked up": the shop flagged the order after its pickup time passed. Kept in its own
-- migration because a new enum value can't be used in the transaction that adds it.
alter type public.order_status add value if not exists 'no_show' after 'picked_up';
