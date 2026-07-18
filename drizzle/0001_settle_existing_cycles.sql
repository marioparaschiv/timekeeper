UPDATE billing_cycles SET settled_at = closed_at WHERE settled_at IS NULL;
