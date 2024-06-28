////////////////////////////////////////////////////////////////////////////////////////////////
//
// EmittionDraw for AutoLuminous.fx
//
////////////////////////////////////////////////////////////////////////////////////////////////

#define SpecularToneCurve  0.3333f  // ���˗��ɑ΂��锭���ω��W��

// ���W�ϊ��s��
float4x4 WorldMatrix     : WORLD;
float4x4 ViewMatrix      : VIEW;
float4x4 ProjMatrix      : PROJECTION;
float4x4 ViewProjMatrix  : VIEWPROJECTION;

//�J�����ʒu
float3 CameraPosition : POSITION  < string Object = "Camera"; >;

// �X�N���[���T�C�Y
float2 ViewportSize : VIEWPORTPIXELSIZE;
static float2 ViewportOffset = float2(0.5f, 0.5f)/ViewportSize;

float AcsAlpha : CONTROLOBJECT < string name = "(self)"; string item = "Tr"; >;


// �������̏��ʋ����`��̃I�t�X�N���[���o�b�t�@
shared texture WF_EmitterRT : OFFSCREENRENDERTARGET;
sampler MirrorEmitterView = sampler_state {
    texture = <WF_EmitterRT>;
    MinFilter = LINEAR;
    MagFilter = LINEAR;
    MipFilter = NONE;
    AddressU  = CLAMP;
    AddressV = CLAMP;
};


#ifndef MIKUMIKUMOVING
    #define ADD_HEIGHT   (0.05f)
    #define GET_VPMAT(p) (ViewProjMatrix)
#else
    #define ADD_HEIGHT   (0.01f)
    #define GET_VPMAT(p) (MMM_IsDinamicProjection ? mul(ViewMatrix, MMM_DynamicFov(ProjMatrix, length(CameraPosition-p.xyz))) : ViewProjMatrix)
#endif


///////////////////////////////////////////////////////////////////////////////////////////////
// �I�u�W�F�N�g�`��i�Z���t�V���h�EOFF�j

struct VS_OUTPUT {
    float4 Pos  : POSITION;
    float4 VPos : TEXCOORD1;
};

// ���_�V�F�[�_
VS_OUTPUT Basic_VS(float4 Pos : POSITION, float2 Tex : TEXCOORD0)
{
    VS_OUTPUT Out = (VS_OUTPUT)0;

    // ���[���h�ϊ�
    Pos = mul( Pos, WorldMatrix );
    Pos.y += ADD_HEIGHT;

    // �J�������_�̃r���[�ˉe�ϊ�
    Out.Pos = mul( Pos, GET_VPMAT(Pos) );
    Out.VPos = Out.Pos;

    return Out;
}

// �s�N�Z���V�F�[�_
float4 Basic_PS(VS_OUTPUT IN) : COLOR0
{
    // �����̃X�N���[���̍��W(���E���]���Ă���̂Ō��ɖ߂�)
    float2 texCoord = float2( 1.0f - ( IN.VPos.x/IN.VPos.w + 1.0f ) * 0.5f,
                              1.0f - ( IN.VPos.y/IN.VPos.w + 1.0f ) * 0.5f ) + ViewportOffset;

    // �����̐F
    float4 Color = tex2D(MirrorEmitterView, texCoord);
    Color *= AcsAlpha; // ���������ʂ̗����ɂ���Obj�𔭌������邽�߃��l����Z

    return Color;
}

float4 ShadowBuff_PS(VS_OUTPUT IN) : COLOR0
{
    // �����̃X�N���[���̍��W(���E���]���Ă���̂Ō��ɖ߂�)
    float2 texCoord = float2( 1.0f - ( IN.VPos.x/IN.VPos.w + 1.0f ) * 0.5f,
                              1.0f - ( IN.VPos.y/IN.VPos.w + 1.0f ) * 0.5f ) + ViewportOffset;

    // �����̐F
    float4 Color = tex2D(MirrorEmitterView, texCoord);
    Color.rgb *= pow(AcsAlpha, SpecularToneCurve) * step(0.01, AcsAlpha);
    Color.w *= AcsAlpha;

    return Color;
}

///////////////////////////////////////////////////////////////////////////////////////////////
// �I�u�W�F�N�g�`��p�e�N�j�b�N
technique MainTec < string MMDPass = "object"; > {
    pass DrawObject {
        AlphaBlendEnable = TRUE;
        DestBlend = ONE;
        SrcBlend = ONE;
        VertexShader = compile vs_2_0 Basic_VS();
        PixelShader  = compile ps_2_0 Basic_PS();
    }
}

technique MainTecSS < string MMDPass = "object_ss"; > {
    pass DrawObject {
        AlphaBlendEnable = TRUE;
        DestBlend = ONE;
        SrcBlend = ONE;
        VertexShader = compile vs_2_0 Basic_VS();
        #ifndef MIKUMIKUMOVING
        PixelShader  = compile ps_2_0 ShadowBuff_PS();
        #else
        PixelShader  = compile ps_2_0 Basic_PS();
        #endif
    }
}


//�e��֊s�͕`�悵�Ȃ�
technique EdgeTec < string MMDPass = "edge"; > { }
technique ShadowTec < string MMDPass = "shadow"; > { }

