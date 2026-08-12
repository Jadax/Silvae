# Silvae release rules. Keep the first release conservative; R8's defaults
# handle Compose and Firebase. Add narrowly scoped rules only when a release
# build or a device test demonstrates that they are required.

# Hilt discovers generated classes at compile time; no broad keep rule needed.

# kotlinx.serialization: the compiler plugin generates a $serializer companion
# per @Serializable class (Species, PlantEntity, IdentifyResponse,
# WeatherPayload, etc. — see domain/care, data/local/entity, data/remote).
# Without these, R8 strips the generated serializers and JSON decode crashes
# at runtime with a class-not-found that only shows up on a real device, not
# in a debug build. Rules per the official kotlinx.serialization guidance.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class org.silvae.**$$serializer { *; }
-keepclassmembers class org.silvae.** {
    *** Companion;
}
-keepclasseswithmembers class org.silvae.** {
    kotlinx.serialization.KSerializer serializer(...);
}
