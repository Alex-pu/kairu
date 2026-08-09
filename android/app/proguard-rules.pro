# kotlinx.serialization keeps generated serializers via annotations; keep them.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class com.safepay.escrow.data.** { *; }
