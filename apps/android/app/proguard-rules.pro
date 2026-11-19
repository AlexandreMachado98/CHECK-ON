# Modelos da API (kotlinx.serialization): manter os serializers gerados.
-keepclassmembers @kotlinx.serialization.Serializable class com.checkon.app.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-keep class com.checkon.app.data.** { *; }
