package org.silvae.auth

import android.app.Activity.RESULT_OK
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import org.silvae.R

/**
 * The mandatory registration/sign-in gate — mirrors apps/web/src/pages/Welcome.tsx.
 * There is no anonymous/guest path: every plant is tied to a real account.
 */
@Composable
fun AuthScreen(viewModel: AuthViewModel = hiltViewModel()) {
    val form by viewModel.form.collectAsState()
    val context = LocalContext.current

    val googleSignInClient = remember {
        val opts = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(context.getString(R.string.default_web_client_id))
            .requestEmail()
            .build()
        GoogleSignIn.getClient(context, opts)
    }

    val googleLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        if (result.resultCode != RESULT_OK) return@rememberLauncherForActivityResult
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(ApiException::class.java)
            val idToken = account?.idToken
            if (idToken != null) viewModel.onGoogleIdToken(idToken)
            else viewModel.onGoogleError("Google sign-in didn't return a token. Try again.")
        } catch (e: ApiException) {
            viewModel.onGoogleError("Google sign-in was cancelled or failed.")
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).imePadding().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier.size(54.dp).clip(RoundedCornerShape(18.dp))
                    .background(MaterialTheme.colorScheme.primary),
                contentAlignment = Alignment.Center,
            ) { Text("♧", color = MaterialTheme.colorScheme.onPrimary, fontSize = 30.sp) }
            Text("Silvae", fontWeight = FontWeight.ExtraBold, fontSize = 22.sp, modifier = Modifier.padding(top = 10.dp))
            Text(
                "Grow happy, free forever",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 20.dp),
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Column(Modifier.padding(20.dp)) {
                    val isSignUp = form.mode == AuthMode.SIGN_UP
                    Text(
                        if (isSignUp) "Let's grow something lovely" else "Good to see you again",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.ExtraBold,
                    )
                    Text(
                        if (isSignUp)
                            "An account keeps your plants, photos, and care history safe and synced across devices."
                        else
                            "Sign in to pick up right where you left off.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 6.dp, bottom = 16.dp),
                    )

                    if (isSignUp) {
                        OutlinedTextField(
                            value = form.name,
                            onValueChange = viewModel::setName,
                            label = { Text("Name") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp),
                        )
                    }
                    OutlinedTextField(
                        value = form.email,
                        onValueChange = viewModel::setEmail,
                        label = { Text("Email") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp),
                    )
                    OutlinedTextField(
                        value = form.password,
                        onValueChange = viewModel::setPassword,
                        label = { Text("Password") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp),
                    )

                    form.error?.let {
                        Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(vertical = 6.dp))
                    }

                    Button(
                        onClick = viewModel::submit,
                        enabled = !form.busy && form.email.isNotBlank() && form.password.length >= 6,
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary),
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    ) {
                        if (form.busy) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                        } else {
                            Text(if (isSignUp) "Create account" else "Sign in", fontWeight = FontWeight.Bold)
                        }
                    }

                    Text(
                        "OR",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(vertical = 12.dp).fillMaxWidth(),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )

                    OutlinedButton(
                        onClick = { googleLauncher.launch(googleSignInClient.signInIntent) },
                        enabled = !form.busy,
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Continue with Google") }

                    TextButton(
                        onClick = { viewModel.setMode(if (isSignUp) AuthMode.SIGN_IN else AuthMode.SIGN_UP) },
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    ) {
                        Text(if (isSignUp) "Already have an account? Sign in" else "New here? Create an account")
                    }
                }
            }
        }
    }
}
