# Generated by Django 2.2.10 on 2022-03-04 14:37

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('specify', '__first__'),
        ('permissions', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Role',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=1024)),
                ('collection', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='specify.Collection')),
            ],
            options={
                'db_table': 'sprole',
            },
        ),
        migrations.CreateModel(
            name='UserRole',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='permissions.Role')),
                ('specifyuser', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'spuserrole',
            },
        ),
        migrations.CreateModel(
            name='RolePolicy',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('resource', models.CharField(max_length=1024)),
                ('action', models.CharField(max_length=1024)),
                ('role', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='permissions.Role')),
            ],
            options={
                'db_table': 'sprolepolicy',
            },
        ),
    ]