package com.dailyenglish.app;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // BridgeActivity가 시작 화면 테마를 앱 테마(AppTheme.NoActionBar)로 바꾼 뒤에 불러야 한다.
        // 먼저 부르면 창 틀이 시작 화면 테마로 만들어져, 제목 막대("Daily…")와 늘어난 시작 화면 그림이 위에 남는다.
        super.onCreate(savedInstanceState);
        // 화면을 상태바와 내비게이션 바 뒤까지 쓰고, 여백은 웹의 safe-area 값으로 맞춘다.
        // (Capacitor 8 SystemBars 설정 insetsHandling: "css"와 함께 쓴다)
        EdgeToEdge.enable(this);
    }
}
