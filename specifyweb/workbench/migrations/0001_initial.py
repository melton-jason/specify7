# Generated by Django 2.2.10 on 2021-01-28 19:44

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django_jsonfield_backport.models # type: ignore


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('specify', '__first__'),
    ]

    operations = [
        migrations.CreateModel(
            name='Spdataset',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=256)),
                ('columns', django_jsonfield_backport.models.JSONField()),
                ('data', django_jsonfield_backport.models.JSONField(default=list)),
                ('uploadplan', django_jsonfield_backport.models.JSONField(null=True)),
                ('uploaderstatus', django_jsonfield_backport.models.JSONField(null=True)),
                ('uploadresult', django_jsonfield_backport.models.JSONField(null=True)),
                ('rowresults', django_jsonfield_backport.models.JSONField(null=True)),
                ('collection', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='specify.Collection')),
                ('specifyuser', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'spdataset',
            },
        ),
    ]
