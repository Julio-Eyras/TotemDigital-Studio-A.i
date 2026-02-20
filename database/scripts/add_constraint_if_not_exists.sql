-- Função helper para adicionar constraints de forma idempotente
CREATE OR REPLACE FUNCTION add_constraint_if_not_exists(
    table_name TEXT,
    constraint_name TEXT,
    constraint_sql TEXT
) RETURNS void AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = constraint_name
        AND conrelid = table_name::regclass::oid
    ) THEN
        EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s', table_name, constraint_name, constraint_sql);
    END IF;
END;
$$ LANGUAGE plpgsql;


