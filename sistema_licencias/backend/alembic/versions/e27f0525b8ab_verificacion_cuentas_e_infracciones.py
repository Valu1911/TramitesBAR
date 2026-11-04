"""verificacion cuentas e infracciones

Revision ID: e27f0525b8ab
Revises: d16e0434e5fd
Create Date: 2026-11-03 20:30:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'e27f0525b8ab'
down_revision: str | None = 'd16e0434e5fd'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Aplica la migración."""
    # Columnas nuevas en citizen_profiles
    op.add_column('citizen_profiles', sa.Column('account_status', sa.String(length=20), server_default='pendiente', nullable=False))
    op.create_index(op.f('ix_citizen_profiles_account_status'), 'citizen_profiles', ['account_status'], unique=False)
    op.add_column('citizen_profiles', sa.Column('fines_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('citizen_profiles', sa.Column('fines_amount', sa.Numeric(precision=10, scale=2), server_default='0.00', nullable=False))
    op.add_column('citizen_profiles', sa.Column('fines_reason', sa.Text(), nullable=True))
    op.add_column('citizen_profiles', sa.Column('fines_reviewed_at', sa.DateTime(), nullable=True))
    op.add_column('citizen_profiles', sa.Column('fines_payment_claimed', sa.Boolean(), server_default=sa.text('0'), nullable=False))
    op.add_column('citizen_profiles', sa.Column('welcome_dismissed', sa.Boolean(), server_default=sa.text('0'), nullable=False))

    # Tabla de mensajería para antecedentes y comprobantes de multas
    op.create_table(
        'account_messages',
        sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
        sa.Column('admin_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
        sa.Column('sender', sa.String(length=10), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('attachment_storage_key', sa.String(length=255), nullable=True),
        sa.Column('attachment_name', sa.String(length=255), nullable=True),
        sa.Column('read_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['admin_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_account_messages_user_id'), 'account_messages', ['user_id'], unique=False)


def downgrade() -> None:
    """Revierte la migración."""
    op.drop_index(op.f('ix_account_messages_user_id'), table_name='account_messages')
    op.drop_table('account_messages')
    op.drop_index(op.f('ix_citizen_profiles_account_status'), table_name='citizen_profiles')
    op.drop_column('citizen_profiles', 'welcome_dismissed')
    op.drop_column('citizen_profiles', 'fines_payment_claimed')
    op.drop_column('citizen_profiles', 'fines_reviewed_at')
    op.drop_column('citizen_profiles', 'fines_reason')
    op.drop_column('citizen_profiles', 'fines_amount')
    op.drop_column('citizen_profiles', 'fines_count')
    op.drop_column('citizen_profiles', 'account_status')
