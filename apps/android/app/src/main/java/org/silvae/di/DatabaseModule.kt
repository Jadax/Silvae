package org.silvae.di

import android.content.Context
import androidx.room.Room
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import org.silvae.data.local.SilvaeDatabase
import org.silvae.data.local.dao.CareEventDao
import org.silvae.data.local.dao.PendingWriteDao
import org.silvae.data.local.dao.PlantDao
import org.silvae.data.local.dao.PlantPhotoDao
import org.silvae.data.local.dao.SettingsDao
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): SilvaeDatabase =
        Room.databaseBuilder(context, SilvaeDatabase::class.java, "silvae.db")
            // Pre-release only: no real user data exists yet to migrate. Must
            // be replaced with real Migration objects before shipping, since
            // this wipes local data (Firestore mirror is unaffected) on any
            // schema bump.
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    fun providePlantDao(db: SilvaeDatabase): PlantDao = db.plantDao()

    @Provides
    fun provideCareEventDao(db: SilvaeDatabase): CareEventDao = db.careEventDao()

    @Provides
    fun providePlantPhotoDao(db: SilvaeDatabase): PlantPhotoDao = db.plantPhotoDao()

    @Provides
    fun providePendingWriteDao(db: SilvaeDatabase): PendingWriteDao = db.pendingWriteDao()

    @Provides
    fun provideSettingsDao(db: SilvaeDatabase): SettingsDao = db.settingsDao()
}
