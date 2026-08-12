package org.silvae.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.flow.first
import org.silvae.MainActivity
import org.silvae.R
import org.silvae.data.PlantRepository
import org.silvae.domain.care.waterStatusLabel
import java.time.Instant

private const val CHANNEL_ID = "watering_reminders"

/**
 * Daily check for plants due to water today — mirrors the "Water me first"
 * section on Home (apps/web/src/pages/Home.tsx), surfaced as a notification
 * since there's no always-open tab on mobile. WorkManager, not a foreground
 * service: this is a once-a-day check, not something that needs to run live.
 */
@HiltWorker
class WateringReminderWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val plantRepository: PlantRepository,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = runCatching {
        val plants = plantRepository.observePlants().first()
        val due = plants.filter { plant ->
            val status = waterStatusLabel(plant.nextWaterAt?.let { runCatching { Instant.parse(it) }.getOrNull() })
            (status.days ?: 1) <= 0
        }.map { it.name }
        if (due.isNotEmpty()) notify(due)
    }.fold(onSuccess = { Result.success() }, onFailure = { Result.retry() })

    private fun notify(names: List<String>) {
        val context = applicationContext
        ensureChannel(context)
        if (Build.VERSION.SDK_INT >= 33 &&
            ActivityCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        val intent = Intent(context, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE)
        val title = if (names.size == 1) "${names.first()} is thirsty today" else "${names.size} plants are thirsty today"
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText("Open Silvae to water them.")
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(1001, notification)
    }
}

fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < 26) return
    val channel = NotificationChannel(CHANNEL_ID, "Watering reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
        description = "Lets you know when a plant is due for water."
    }
    (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
}
